/**
 * CounterPoints Knowledge Base
 *
 * Three Firestore collections:
 *   cp_claims        — verified claims with embeddings + full spectrum results
 *   cp_source_stats  — per-domain per-topic quality scores (learning system)
 *   cp_topic_routing — cached best-domain list per topic (refreshed every 50 uses)
 *
 * Lookup flow:
 *   1. Embed incoming claim (Gemini text-embedding-004, cached in process)
 *   2. Query cp_claims by topicBucket, limit 100 most recent
 *   3. Compute cosine similarity vs each candidate embedding
 *   4. If best ≥ 0.92 AND claim is not time-sensitive → return cached card instantly
 *   5. If best 0.82–0.91 → still run pipeline but log that a similar claim existed
 *   6. After pipeline → store result + update source stats
 */

import { getDb } from './firebase-admin'
import { getEmbedding, cosineSim, topicBucket, isTimeSensitive } from './embeddings'
import type { CounterpointCard, SpectrumItem, Verdict } from '@/types'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CachedClaim {
  id: string
  claimText: string
  verdict: Verdict
  verdictSummary: string
  spectrum: CounterpointCard['spectrum']
  topic: string
  topicBucket: string
  similarity: number    // cosine sim to the query claim
  hitCount: number
  createdAt: number
  cacheHit: true
}

interface ClaimDoc {
  claimText: string
  embedding: number[]
  verdict: Verdict
  verdictSummary: string
  spectrum: CounterpointCard['spectrum']
  topic: string
  topicBucket: string
  hitCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Thresholds ────────────────────────────────────────────────────────────────
const EXACT_THRESHOLD  = 0.92  // treat as same claim → skip pipeline
const SIMILAR_THRESHOLD = 0.82 // note similarity but still run pipeline

// ─── Claim Cache ───────────────────────────────────────────────────────────────

export async function findCachedClaim(
  claim: string,
  topic: string
): Promise<CachedClaim | null> {
  // Never serve stale cache for time-sensitive claims
  if (isTimeSensitive(claim)) {
    console.log('[kb] time-sensitive claim, bypassing cache:', claim.slice(0, 60))
    return null
  }

  const embedding = await getEmbedding(claim)
  if (embedding.length === 0) return null

  const bucket = topicBucket(topic)

  try {
    const db = getDb()
    const snapshot = await db.collection('cp_claims')
      .where('topicBucket', '==', bucket)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()

    if (snapshot.empty) return null

    let bestId   = ''
    let bestDoc: ClaimDoc | null = null
    let bestSim  = 0

    for (const snap of snapshot.docs) {
      const data = snap.data() as ClaimDoc
      if (!data.embedding?.length) continue
      const sim = cosineSim(embedding, data.embedding)
      if (sim > bestSim) { bestId = snap.id; bestDoc = data; bestSim = sim }
    }

    if (!bestDoc || bestSim < EXACT_THRESHOLD) {
      if (bestDoc && bestSim >= SIMILAR_THRESHOLD) {
        console.log(`[kb] similar claim (${bestSim.toFixed(3)}) but below exact threshold, running fresh pipeline`)
      }
      return null
    }

    console.log(`[kb] CACHE HIT (sim=${bestSim.toFixed(3)}) for: "${claim.slice(0, 60)}"`)

    // Increment hit count in background
    db.collection('cp_claims').doc(bestId).update({
      hitCount: FieldValue.increment(1),
      updatedAt: Timestamp.now(),
    }).catch(() => {})

    return {
      id:             bestId,
      claimText:      bestDoc.claimText,
      verdict:        bestDoc.verdict,
      verdictSummary: bestDoc.verdictSummary,
      spectrum:       bestDoc.spectrum,
      topic:          bestDoc.topic,
      topicBucket:    bestDoc.topicBucket,
      similarity:     bestSim,
      hitCount:       bestDoc.hitCount,
      createdAt:      bestDoc.createdAt?.toMillis?.() ?? 0,
      cacheHit:       true,
    }
  } catch (e) {
    console.error('[kb] findCachedClaim error:', e)
    return null
  }
}

export async function storeClaim(
  claim: string,
  topic: string,
  verdict: Verdict,
  verdictSummary: string,
  spectrum: CounterpointCard['spectrum']
): Promise<void> {
  try {
    const embedding = await getEmbedding(claim)
    const bucket = topicBucket(topic)
    const db = getDb()

    await db.collection('cp_claims').add({
      claimText:      claim,
      embedding,
      verdict,
      verdictSummary,
      spectrum,
      topic,
      topicBucket:    bucket,
      hitCount:       0,
      createdAt:      Timestamp.now(),
      updatedAt:      Timestamp.now(),
    } satisfies ClaimDoc)

    console.log(`[kb] stored claim (${verdict}) topic=${bucket}: "${claim.slice(0, 60)}"`)
  } catch (e) {
    console.error('[kb] storeClaim error:', e)
  }
}

// ─── Source Performance Tracker (learning system) ─────────────────────────────

/**
 * Call after every pipeline run.
 * helpful=true  → this domain returned evidence that contributed to a non-UNVERIFIED verdict
 * helpful=false → domain was queried but verdict remained UNVERIFIED (no useful signal)
 */
export async function trackSourceUse(
  domains: string[],
  bucket: string,
  verdict: Verdict
): Promise<void> {
  if (domains.length === 0) return

  const helpful = verdict !== 'UNVERIFIED'
  const db = getDb()
  const batch = db.batch()

  for (const domain of domains) {
    if (!domain) continue
    const docId = `${domain.replace(/[^a-z0-9]/gi, '_')}_${bucket}`
    const ref = db.collection('cp_source_stats').doc(docId)

    batch.set(ref, {
      domain,
      topicBucket: bucket,
      totalUses:   FieldValue.increment(1),
      helpfulUses: FieldValue.increment(helpful ? 1 : 0),
      lastUsed:    Timestamp.now(),
    }, { merge: true })
  }

  try {
    await batch.commit()

    // Refresh topic routing table every 50 uses (async, non-blocking)
    const statsSnap = await db.collection('cp_source_stats')
      .where('topicBucket', '==', bucket)
      .orderBy('totalUses', 'desc')
      .limit(1)
      .get()

    if (!statsSnap.empty) {
      const top = statsSnap.docs[0].data()
      if ((top.totalUses ?? 0) % 50 === 0) {
        refreshTopicRouting(bucket).catch(() => {})
      }
    }
  } catch (e) {
    console.error('[kb] trackSourceUse error:', e)
  }
}

/**
 * Rebuilds the best-sources list for a topic bucket.
 * Called every 50 uses per bucket (background, non-blocking).
 */
async function refreshTopicRouting(bucket: string): Promise<void> {
  try {
    const db = getDb()
    const snap = await db.collection('cp_source_stats')
      .where('topicBucket', '==', bucket)
      .where('totalUses', '>=', 3)
      .orderBy('totalUses', 'desc')
      .limit(30)
      .get()

    if (snap.empty) return

    const ranked = snap.docs
      .map(d => {
        const s = d.data()
        const quality = s.totalUses > 0 ? (s.helpfulUses / s.totalUses) : 0
        // Weight by quality score × log(uses) to balance accuracy and volume
        const score = quality * Math.log1p(s.totalUses)
        return { domain: s.domain as string, score: Math.round(score * 1000) / 1000, uses: s.totalUses as number }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)

    await db.collection('cp_topic_routing').doc(bucket).set({
      topicBucket:  bucket,
      bestDomains:  ranked,
      updatedAt:    Timestamp.now(),
    })

    console.log(`[kb] refreshed routing for ${bucket}: top domains = ${ranked.slice(0, 5).map(r => r.domain).join(', ')}`)
  } catch (e) {
    console.error('[kb] refreshTopicRouting error:', e)
  }
}

/**
 * Returns learned best domains for a topic bucket.
 * Falls back to empty array if not enough data yet.
 * Callers merge with static defaults.
 */
export async function getLearnedDomains(
  bucket: string,
  limit = 8
): Promise<string[]> {
  try {
    const db = getDb()
    const doc = await db.collection('cp_topic_routing').doc(bucket).get()
    if (!doc.exists) return []

    const data = doc.data() as { bestDomains?: { domain: string; score: number; uses: number }[] }
    return (data.bestDomains ?? [])
      .filter(d => d.uses >= 5)   // only trust domains with enough signal
      .slice(0, limit)
      .map(d => d.domain)
  } catch {
    return []
  }
}

// ─── Admin / Debug ─────────────────────────────────────────────────────────────

export async function getKbStats(): Promise<{
  totalClaims: number
  topicCounts: Record<string, number>
  topDomains: { domain: string; bucket: string; quality: number; uses: number }[]
}> {
  const db = getDb()

  const [claimsSnap, statsSnap] = await Promise.all([
    db.collection('cp_claims').select('topicBucket').get(),
    db.collection('cp_source_stats').orderBy('totalUses', 'desc').limit(20).get(),
  ])

  const topicCounts: Record<string, number> = {}
  claimsSnap.forEach(d => {
    const b = (d.data().topicBucket as string) ?? 'general'
    topicCounts[b] = (topicCounts[b] ?? 0) + 1
  })

  const topDomains = statsSnap.docs.map(d => {
    const s = d.data()
    return {
      domain:  s.domain as string,
      bucket:  s.topicBucket as string,
      quality: s.totalUses > 0 ? Math.round((s.helpfulUses / s.totalUses) * 100) : 0,
      uses:    s.totalUses as number,
    }
  })

  return { totalClaims: claimsSnap.size, topicCounts, topDomains }
}
