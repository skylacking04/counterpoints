import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase-admin'

export const runtime = 'nodejs'

const ADMIN_EMAIL = 'skylacking@gmail.com'

export async function GET(req: NextRequest) {
  // Simple auth — must pass ?secret= matching env var, or be the admin email in header
  const secret = req.nextUrl.searchParams.get('secret')
  const adminSecret = process.env.ADMIN_SECRET ?? 'counterpoints-admin'
  if (secret !== adminSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = getDb()

  const [eventsSnap, dailySnap] = await Promise.all([
    db.collection('analytics_events')
      .orderBy('ts', 'desc')
      .limit(500)
      .get(),
    db.collection('analytics_daily')
      .orderBy('date', 'desc')
      .limit(60)
      .get(),
  ])

  const events = eventsSnap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    ts: d.data().ts?.toDate?.()?.toISOString() ?? null,
  }))

  const daily = dailySnap.docs.map(d => d.data())

  return NextResponse.json({ events, daily })
}
