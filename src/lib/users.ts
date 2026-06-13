import { createHash } from 'node:crypto'
import { getDb } from '@/lib/firebase-admin'
import type { CpUser, HistoryEntry } from '@/types'

const USERS = 'cp_users'
export const userIdForEmail = (email: string) => createHash('sha1').update(email.trim().toLowerCase()).digest('hex')

/** Upsert a user by email. Returns the stable userId. */
export async function upsertUser(email: string): Promise<CpUser> {
  const userId = userIdForEmail(email)
  const ref = getDb().collection(USERS).doc(userId)
  const now = Date.now()
  const snap = await ref.get()
  if (snap.exists) {
    await ref.set({ lastSeen: now }, { merge: true })
    return { userId, email, createdAt: (snap.data()!.createdAt as number) ?? now, lastSeen: now }
  }
  await ref.set({ email: email.trim().toLowerCase(), createdAt: now, lastSeen: now })
  return { userId, email, createdAt: now, lastSeen: now }
}

/** Write a history pointer for a user (no-op if userId missing). Best-effort. */
export async function addHistory(userId: string | undefined, entry: HistoryEntry): Promise<void> {
  if (!userId) return
  try {
    await getDb().collection(USERS).doc(userId).collection('history').doc(entry.urlHash).set(entry, { merge: true })
  } catch (e) { console.error('[users] addHistory failed', e) }
}

/** Most-recent-first history list for a user. */
export async function getUserHistory(userId: string, limit = 50): Promise<HistoryEntry[]> {
  const snap = await getDb().collection(USERS).doc(userId).collection('history')
    .orderBy('createdAt', 'desc').limit(limit).get()
  return snap.docs.map(d => d.data() as HistoryEntry)
}
