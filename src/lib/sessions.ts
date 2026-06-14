import { getDb } from '@/lib/firebase-admin'
import type { CpSession, CounterpointCard } from '@/types'

const SESSIONS = 'cp_sessions'

// Sessions created without the arrays (to avoid clobbering) may lack cards/transcript.
// Always hand the client complete arrays so `.length` reads never crash.
function normalizeSession(data: FirebaseFirestore.DocumentData): CpSession {
  return { ...data, cards: data.cards ?? [], transcript: data.transcript ?? [] } as CpSession
}

export async function getSessionByVideo(videoId: string, userId: string): Promise<CpSession | null> {
  try {
    const snap = await getDb()
      .collection(SESSIONS)
      .where('videoId', '==', videoId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()
    if (snap.empty) return null
    return normalizeSession(snap.docs[0].data())
  } catch (e) {
    console.error('[sessions] getSessionByVideo failed', e)
    return null
  }
}

// Accepts partial session for merge-style updates (only sessionId required).
// NOTE: the client now sends the COMPLETE (untruncated) card list, so replacing `cards` is safe
// and honors intentional archive/dismiss. The accidental "restore erased on new fact-check" bug
// was caused by the client-side .slice(0,50) cap (removed in page.tsx), not this write.
export async function upsertSession(session: Partial<CpSession> & { sessionId: string }): Promise<void> {
  try {
    await getDb().collection(SESSIONS).doc(session.sessionId).set(
      { ...session, updatedAt: Date.now() },
      { merge: true }
    )
  } catch (e) {
    console.error('[sessions] upsertSession failed', e)
  }
}

export async function addCardToSession(sessionId: string, card: CounterpointCard): Promise<void> {
  try {
    const ref = getDb().collection(SESSIONS).doc(sessionId)
    const snap = await ref.get()
    // Create the doc if it doesn't exist yet (card save can race ahead of session creation).
    const existing = (snap.exists ? (snap.data()?.cards ?? []) : []) as CounterpointCard[]
    const updated = existing.some(c => c.id === card.id)
      ? existing.map(c => c.id === card.id ? card : c)   // update in place (new sources, re-research)
      : [...existing, card]
    const slim = updated.map(c => ({ ...c, visionSnapshot: null, voiceSnapshot: null }))
    await ref.set({ cards: slim, updatedAt: Date.now() }, { merge: true })
  } catch (e) {
    console.error('[sessions] addCardToSession failed', e)
  }
}

// Re-key all sessions from one userId to another (anon → email on first login),
// so work done while anonymous isn't lost. Returns the number of sessions moved.
export async function reassignSessions(fromUserId: string, toUserId: string): Promise<number> {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return 0
  try {
    const snap = await getDb().collection(SESSIONS).where('userId', '==', fromUserId).get()
    if (snap.empty) return 0
    const batch = getDb().batch()
    snap.docs.forEach(d => batch.update(d.ref, { userId: toUserId }))
    await batch.commit()
    console.log(`[sessions] reassigned ${snap.size} sessions ${fromUserId} → ${toUserId}`)
    return snap.size
  } catch (e) {
    console.error('[sessions] reassignSessions failed', e)
    return 0
  }
}

export async function listSessions(userId: string, limit = 50): Promise<CpSession[]> {
  try {
    const snap = await getDb()
      .collection(SESSIONS)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    return snap.docs.map(d => normalizeSession(d.data()))
  } catch (e) {
    console.error('[sessions] listSessions failed', e)
    return []
  }
}
