import { NextRequest, NextResponse } from 'next/server'
import { addCardToSession } from '@/lib/sessions'
import type { CounterpointCard } from '@/types'

export const runtime = 'nodejs'

// POST { sessionId, card } — upsert a single card in a session
export async function POST(req: NextRequest) {
  try {
    const { sessionId, card } = await req.json() as { sessionId: string; card: CounterpointCard }
    if (!sessionId || !card?.id) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    await addCardToSession(sessionId, card)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
}
