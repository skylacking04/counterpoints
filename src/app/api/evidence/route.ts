import { NextRequest, NextResponse } from 'next/server'
import { callLLM } from '@/lib/llm'
import { searchArticles } from '@/lib/firecrawl'
import { searchGrokNotes, cleanGrokSpectrum } from '@/lib/grok-notes'
import { searchTrustedChannels } from '@/lib/youtube-search'
import { getSourceProfile, SPECTRUM_DOMAINS, POLITICAL_DOMAINS } from '@/lib/source-db'
import { CHANNELS_BY_TOPIC } from '@/lib/trusted-channels'
import { findCachedClaim, storeClaim, trackSourceUse, getLearnedDomains } from '@/lib/knowledge-base'
import { topicBucket, isTimeSensitive } from '@/lib/embeddings'
import type { CounterpointCard, LLMSettings, SpectrumItem, SpectrumLens, Verdict } from '@/types'

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Agent final-step gate: ONE batched LLM call validates that each X post is on-topic for the
// claim AND contains a substantive factual statement (not bios, ads, search placeholders, or
// vague chatter). Degrades gracefully — on any failure it keeps the posts as-is.
async function validateXPosts(items: SpectrumItem[], claim: string, settings?: LLMSettings): Promise<SpectrumItem[]> {
  if (items.length === 0) return items
  try {
    const numbered = items.map((it, i) => `[${i}] ${it.source}: ${it.quote}`).join('\n')
    const raw = await callLLM([
      {
        role: 'system',
        content: 'You filter social posts for a fact-check. Respond with JSON only: { "keep": [indices] }. Keep ONLY posts that are BOTH (a) clearly about the same topic as the claim AND (b) contain a substantive factual statement, correction, or community note — not bios, ads, promos, search-page placeholders, or vague chatter. If unsure, drop it.',
      },
      { role: 'user', content: `Claim: "${claim}"\n\nPosts:\n${numbered}\n\nWhich indices should be kept?` },
    ], settings)
    const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
    if (!Array.isArray(parsed?.keep)) return items
    const keep = new Set<number>(parsed.keep.map((n: unknown) => Number(n)))
    const filtered = items.filter((_, i) => keep.has(i))
    return filtered.length > 0 ? filtered : []
  } catch {
    return items  // never break the pipeline on a validation hiccup
  }
}

// A URL that's actually an X/Twitter post (not a random web article the fallback dragged in).
function isXPostUrl(url: string): boolean {
  return /(?:^https?:\/\/)?(?:[a-z0-9-]+\.)?(?:x\.com|twitter\.com)\/[^/]+\/status/i.test(url)
    || /(?:^https?:\/\/)?(?:[a-z0-9-]+\.)?(?:x\.com|twitter\.com)\//i.test(url)
}

// Whole X/Community lens: gather notes+posts, keep ONLY real x.com/twitter.com links (the web-search
// fallback returns non-X articles that don't belong here), then run the relevance/factual gate.
async function buildGrokLens(claim: string, settings?: LLMSettings): Promise<SpectrumItem[]> {
  const grokResult = await searchGrokNotes(claim)
  const raw: SpectrumItem[] = [
    ...(grokResult?.notes ?? []).map(n => ({ source: 'X Community Note', url: n.url, quote: n.text })),
    ...(grokResult?.posts ?? []).map(p => ({ source: `@${p.author}`, url: p.url, quote: p.text })),
  ].filter(i => isXPostUrl(i.url))
  return validateXPosts(raw, claim, settings)
}

function isPoliticalTopic(topic: string): boolean {
  const t = topic.toLowerCase()
  return /politi|govern|elect|congress|senate|president|law|policy|democrat|republican|left|right|war|military|foreign|immigration|tax|budget|climate policy/.test(t)
}

async function buildSpectrumItems(
  lens: SpectrumLens,
  claim: string,
  topic: string,
  settings?: LLMSettings,
  learnedDomains?: string[]
): Promise<SpectrumItem[]> {
  if (lens === 'grok') return []

  // Merge: learned best domains for this topic + static list (deduplicated)
  const domainMap = isPoliticalTopic(topic) ? POLITICAL_DOMAINS : SPECTRUM_DOMAINS
  const staticDomains = (domainMap as Record<string, string[]>)[lens] ?? SPECTRUM_DOMAINS[lens as keyof typeof SPECTRUM_DOMAINS] ?? []
  const merged = learnedDomains?.length
    ? [...new Set([...learnedDomains.slice(0, 4), ...staticDomains])]
    : staticDomains
  let articles = await searchArticles(`${claim} ${topic}`, merged, 2, lens)
  // Loosen if the domain-restricted search found nothing — drop the domain filter to surface
  // the closest available source for this lens rather than showing a blank column.
  if (articles.length === 0) {
    articles = await searchArticles(`${claim} ${topic}`, [], 2, lens)
  }

  // One quote LLM call per article (both articles in parallel). The old per-article
  // journalist-bias summary call was dropped — it doubled lens latency and pushed lenses
  // past the timeout, which is why left/center/right stopped returning sources.
  return Promise.all(
    articles.slice(0, 2).map(async (art) => {
      const profile = getSourceProfile(art.url)
      // If the quote LLM fails (e.g. Vertex 429), still show the source using its own snippet.
      let quote = ''
      try {
        quote = (await callLLM([
          { role: 'system', content: 'Respond with 1 sentence only, no markdown, no quotes.' },
          {
            role: 'user',
            content: `Claim: "${claim}"
Article excerpt: "${art.markdown.slice(0, 800)}"
In one sentence, what does this article say about the claim? Be specific, cite a key fact or figure if present.`,
          },
        ], settings)).trim()
      } catch { /* fall back below */ }
      if (!quote) quote = art.markdown.slice(0, 200).trim() || art.title || '(source found — summary unavailable)'

      return {
        source:        art.title || profile?.domain || art.url,
        url:           art.url,
        quote,
        publishedDate: art.publishedDate,
        bias:          profile?.bias,
        allSidesRating: profile?.allSidesRating,
        reliability:   profile?.reliability,
      } satisfies SpectrumItem
    })
  )
}

async function buildAltItems(
  claim: string,
  topic: string,
  settings?: LLMSettings
): Promise<SpectrumItem[]> {
  const political = isPoliticalTopic(topic)
  const altDomains = political ? POLITICAL_DOMAINS.alt : SPECTRUM_DOMAINS.alt

  // For political topics, search a broader channel set including TJDS, Kim Iversen, Valuetainment, Vigilant Fox
  const channelQuery = `${topic} ${claim.split(' ').slice(0, 6).join(' ')}`
  const channelTopicKey = political ? 'political' : 'general'

  const [articles, videos] = await Promise.all([
    searchArticles(`${claim} ${topic}`, altDomains, 2, 'alt'),
    searchTrustedChannels(channelQuery, (CHANNELS_BY_TOPIC[channelTopicKey] ?? []).map(c => c.channelId).slice(0, 8)),
  ])

  const items: SpectrumItem[] = []

  for (const art of articles.slice(0, 1)) {
    const profile = getSourceProfile(art.url)
    let quote = ''
    try {
      quote = (await callLLM([
        { role: 'system', content: 'Respond with 1 sentence only.' },
        { role: 'user', content: `Claim: "${claim}"\nArticle: "${art.markdown.slice(0, 600)}"\nOne sentence: what does this say about the claim?` },
      ], settings)).trim()
    } catch { /* fall back below */ }
    if (!quote) quote = art.markdown.slice(0, 200).trim() || art.title || '(source found — summary unavailable)'
    items.push({
      source: art.title || art.url,
      url: art.url,
      quote,
      bias: profile?.bias ?? 'alt',
      reliability: profile?.reliability,
    })
  }

  for (const vid of videos.slice(0, 2)) {
    if (!vid.captionWindow) continue
    let quoteRaw = ''
    try {
      quoteRaw = await callLLM([
        { role: 'system', content: 'Respond with 1 sentence only.' },
        { role: 'user', content: `Claim: "${claim}"\nVideo caption: "${vid.captionWindow.slice(0, 600)}"\nOne sentence: what does this video say about the claim?` },
      ], settings)
    } catch { quoteRaw = vid.captionWindow.slice(0, 200) }
    items.push({
      source:             `${vid.channelName} video`,
      url:                vid.watchUrl,
      quote:              quoteRaw.trim(),
      videoId:            vid.videoId,
      videoTimestampSec:  vid.timestampSec ?? undefined,
      channelName:        vid.channelName,
      thumbnailUrl:       vid.thumbnailUrl,
    })
  }

  return items
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { claim: string; topic: string; claimId: string; settings?: LLMSettings; noCache?: boolean }
  const claim   = String(body.claim  ?? '').slice(0, 500)
  const topic   = String(body.topic  ?? '').slice(0, 100)
  const claimId = String(body.claimId ?? '').slice(0, 64)
  const settings = body.settings
  const noCache  = body.noCache === true   // re-run sources: force a fresh search, skip the cache

  if (!claim.trim() || !claimId) {
    return NextResponse.json({ error: 'claim and claimId required' }, { status: 400 })
  }

  const bucket = topicBucket(topic)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const write = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      try {
        const [cached, learnedDomains] = await Promise.all([
          noCache ? Promise.resolve(null) : findCachedClaim(claim, topic),
          getLearnedDomains(bucket, 8),
        ])

        // Only trust the cache if it actually has article sources across the spectrum. Older
        // cached entries were stored before source-gathering worked and have empty L/C/R — for
        // those, fall through to a fresh search instead of serving blank sources.
        const cachedSp = cached?.spectrum
        const cachedArticleCount = cachedSp
          ? (cachedSp.left?.length ?? 0) + (cachedSp.center?.length ?? 0) + (cachedSp.right?.length ?? 0) + (cachedSp.alt?.length ?? 0)
          : 0

        if (cached && cachedArticleCount > 0) {
          // Scrub stale garbage/irrelevant X posts that may have been cached previously.
          if (cached.spectrum?.grok) {
            cached.spectrum.grok = cleanGrokSpectrum(cached.spectrum.grok, claim)
          }
          const card: CounterpointCard = {
            id: claimId,
            claimId,
            claim,
            verdict:        cached.verdict,
            verdictSummary: `${cached.verdictSummary} *(from knowledge base — ${Math.round(cached.similarity * 100)}% match)*`,
            spectrum:       cached.spectrum,
            createdAt:      Date.now(),
            cacheHit:       true,
            cacheSimilarity: cached.similarity,
          }
          write({ type: 'done', card })
          controller.close()
          return
        }

        // Stream each lens as it resolves
        const spectrum: Record<string, SpectrumItem[]> = { left: [], center: [], right: [], alt: [], grok: [] }

        // Cap each lens so one slow web search can't gate the verdict. A lens that times out
        // returns whatever it had (usually []); the verdict proceeds with the rest. This keeps
        // time-to-verdict well under 15s. Slow lenses still stream in late (refinement).
        // Primary Tavily key now has credits (no 432 rotation waste). Keep a modest cap so a
        // single slow lens can't stall the verdict.
        const LENS_TIMEOUT_MS = 14_000
        const withTimeout = <T>(p: Promise<T>, fallback: T): Promise<T> =>
          Promise.race([p, new Promise<T>(r => setTimeout(() => r(fallback), LENS_TIMEOUT_MS))])

        // Each lens: stream when it resolves; on failure yield [] so it can never reject the
        // whole Promise.all (which would crash the stream and leave the card stuck on "Checking…").
        const runLens = (key: string, p: Promise<SpectrumItem[]>) =>
          withTimeout(p, [] as SpectrumItem[])
            .then(items => { spectrum[key] = items; write({ type: 'lens', key, items }) })
            .catch(() => { spectrum[key] = []; write({ type: 'lens', key, items: [] }) })

        await Promise.all([
          runLens('left',   buildSpectrumItems('left', claim, topic, settings, learnedDomains)),
          runLens('center', buildSpectrumItems('center', claim, topic, settings, learnedDomains)),
          runLens('right',  buildSpectrumItems('right', claim, topic, settings, learnedDomains)),
          runLens('alt',    buildAltItems(claim, topic, settings)),
          runLens('grok',   buildGrokLens(claim, settings)),
        ])

        const allEvidence = [...spectrum.center, ...spectrum.left, ...spectrum.right, ...spectrum.alt, ...spectrum.grok]
          .map(i => i.quote).join('\n')

        // Label evidence by political lens so the verdict engine can explicitly contrast how the
        // LEFT vs the RIGHT frame the claim, then reconcile to the factual middle ground.
        const labeledEvidence = ([
          ['LEFT-leaning sources (e.g. MSNBC, The Hill left)', spectrum.left],
          ['RIGHT-leaning / conservative sources (e.g. Fox News)', spectrum.right],
          ['CENTER / wire-service sources (e.g. Reuters, AP)', spectrum.center],
          ['Independent / heterodox sources', spectrum.alt],
          ['X Community Notes & posts', spectrum.grok],
        ] as [string, SpectrumItem[]][])
          .filter(([, items]) => items.length > 0)
          .map(([label, items]) => `${label}:\n${items.map(i => `- ${i.source}: ${i.quote}`).join('\n')}`)
          .join('\n\n')

        const verdictRaw = await callLLM([
          {
            role: 'system',
            content: `You are a non-partisan fact-checker. The left and the right often frame the same claim very differently. Read BOTH sides, then determine the factual middle ground — what is actually verifiable, independent of spin.

Respond with JSON only: { "verdict": "TRUE"|"MISLEADING"|"FALSE"|"UNVERIFIED", "summary": "one sentence", "middleGround": "one sentence stating the actual facts that cut through the left/right framing", "evidenceCount": 0 }

CALIBRATION RULES — follow strictly:
- UNVERIFIED: Default when evidence is thin, absent, inconclusive, or the claim is about breaking/live news. When in doubt, use UNVERIFIED.
- TRUE: Only when 2+ independent reliable sources clearly corroborate the specific claim.
- MISLEADING: When the claim is technically inaccurate, exaggerated, or missing important context supported by evidence.
- FALSE: Only when 2+ independent reliable sources explicitly contradict the claim with specific verifiable facts. ONE source is never enough for FALSE.
- Hedged claims ("as many as", "up to", "approximately", "around", "nearly"): Treat small numeric discrepancies as UNVERIFIED, not FALSE — these are estimates.
- Live/breaking news: Always default to UNVERIFIED unless you have definitive contradicting evidence.
- "middleGround": If left and right disagree, state what the neutral/center + independent evidence actually supports. If sources broadly agree, restate the verified fact plainly. Never take a partisan side.`,
          },
          { role: 'user', content: `Claim: "${claim}"\n\nEvidence grouped by perspective:\n${labeledEvidence || 'No evidence found.'}\n\nReconcile the sides and give your verdict + the factual middle ground.` },
        ], settings)

        let verdict: Verdict = 'UNVERIFIED'
        let verdictSummary = 'No consensus found.'
        let middleGround = ''
        try {
          const v = JSON.parse(verdictRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
          verdict = v.verdict ?? 'UNVERIFIED'
          verdictSummary = v.summary ?? verdictSummary
          middleGround = typeof v.middleGround === 'string' ? v.middleGround : ''
        } catch { /* keep defaults */ }

        // Only TRUE/FALSE can be downgraded by the verify pass — skip it otherwise (saves ~3s)
        if ((verdict === 'TRUE' || verdict === 'FALSE') && allEvidence.length > 80) {
          const verifyRaw = await callLLM([
            {
              role: 'system',
              content: 'You are a fact-checker. Respond with JSON only: { "contradicted": true|false, "contradiction": "null or one sentence describing what specifically contradicts the verdict" }',
            },
            {
              role: 'user',
              content: `Claim: "${claim}"
Current verdict: ${verdict}
Evidence: "${allEvidence.slice(0, 1200)}"

Does ANY piece of evidence above SPECIFICALLY CONTRADICT the ${verdict} verdict?
- Set contradicted=true ONLY if a source explicitly says the claim is ${verdict === 'TRUE' ? 'false or misleading' : 'actually true'}
- Set contradicted=false if evidence is thin, absent, or simply doesn't address the claim
- Do NOT downgrade just because you personally doubt the claim — only on active contradiction
Respond:`,
            },
          ], settings)

          try {
            const verify = JSON.parse(verifyRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
            if (verify.contradicted && verify.contradiction && verify.contradiction !== 'null') {
              if (verdict === 'FALSE') {
                verdict = 'MISLEADING'
                verdictSummary = `Disputed: ${verify.contradiction}`
              } else if (verdict === 'TRUE') {
                verdict = 'MISLEADING'
                verdictSummary = `Partially disputed: ${verify.contradiction}`
              }
            }
          } catch { /* keep pass-1 verdict */ }
        }

        const card: CounterpointCard = {
          id: claimId,
          claimId,
          claim,
          verdict,
          verdictSummary,
          middleGround: middleGround || undefined,
          spectrum: spectrum as CounterpointCard['spectrum'],
          createdAt: Date.now(),
        }

        Promise.all([
          storeClaim(claim, topic, verdict, verdictSummary, card.spectrum),
          trackSourceUse(
            [...spectrum.center, ...spectrum.left, ...spectrum.right, ...spectrum.alt]
              .map(i => { try { return new URL(i.url).hostname.replace('www.', '') } catch { return '' } })
              .filter(Boolean),
            bucket,
            verdict
          ),
        ]).catch(e => console.error('[evidence] KB background save error:', e))

        write({ type: 'done', card })
      } catch (e) {
        console.error('[evidence] stream error:', e)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } })
}
