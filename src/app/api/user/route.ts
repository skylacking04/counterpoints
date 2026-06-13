import { NextRequest, NextResponse } from 'next/server'
import { upsertUser, getUserHistory } from '@/lib/users'
import { reassignSessions } from '@/lib/sessions'

export const runtime = 'nodejs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST { email, mergeFromUserId? } → upsert user, return { userId, email, merged }. No password.
// If mergeFromUserId is an anonymous id, its sessions are re-keyed to the email user (first login).
export async function POST(req: NextRequest) {
  let email = ''
  let mergeFromUserId = ''
  try {
    const body = await req.json() as { email?: string; mergeFromUserId?: string }
    email = body.email ?? ''
    mergeFromUserId = body.mergeFromUserId ?? ''
  } catch { /* ignore */ }
  email = email.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  const user = await upsertUser(email)
  // Preserve work done while anonymous by moving those sessions to the email identity
  let merged = 0
  if (mergeFromUserId.startsWith('anon_') && mergeFromUserId !== user.userId) {
    merged = await reassignSessions(mergeFromUserId, user.userId)
  }
  return NextResponse.json({ ...user, merged })
}

// GET ?userId= → { history: HistoryEntry[] }
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'no_userId' }, { status: 400 })
  const history = await getUserHistory(userId)
  return NextResponse.json({ userId, history })
}
