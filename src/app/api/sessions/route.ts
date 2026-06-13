import { NextRequest, NextResponse } from 'next/server'
import { upsertSession, listSessions } from '@/lib/sessions'
import type { CpSession } from '@/types'

export const runtime = 'nodejs'

// POST { sessionId, ...fields } — create or partially update a session (merge: true)
export async function POST(req: NextRequest) {
  try {
    const data = await req.json() as Partial<CpSession> & { sessionId?: string }
    if (!data.sessionId) {
      return NextResponse.json({ error: 'missing_sessionId' }, { status: 400 })
    }
    await upsertSession(data as CpSession)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
}

// GET ?userId= — list sessions for a user
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId') ?? req.nextUrl.searchParams.get('deviceId') ?? ''
  if (!userId) return NextResponse.json({ sessions: [] })
  const sessions = await listSessions(userId)
  return NextResponse.json({ sessions })
}
