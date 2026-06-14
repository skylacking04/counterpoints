import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export const runtime = 'nodejs'

// Cloud Run injects these geo headers automatically on every request
function geo(req: NextRequest) {
  return {
    city:    req.headers.get('x-appengine-city')    ?? req.headers.get('x-vercel-ip-city')    ?? null,
    region:  req.headers.get('x-appengine-region')  ?? req.headers.get('x-vercel-ip-country-region') ?? null,
    country: req.headers.get('x-appengine-country') ?? req.headers.get('x-vercel-ip-country') ?? null,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      event: string        // e.g. 'page_view', 'live_capture', 'fact_check', 'url_paste'
      page?: string        // e.g. '/', '/how-to', '/app'
      userId?: string
      meta?: Record<string, string | number | boolean>
    }
    if (!body.event) return NextResponse.json({ ok: false }, { status: 400 })

    const location = geo(req)
    const db = getDb()

    // Write individual event
    await db.collection('analytics_events').add({
      event:     body.event,
      page:      body.page ?? null,
      userId:    body.userId ?? null,
      meta:      body.meta ?? {},
      ...location,
      ts: FieldValue.serverTimestamp(),
    })

    // Roll up daily counters — one doc per event per day
    const day = new Date().toISOString().slice(0, 10) // "2026-06-14"
    const counterId = `${day}__${body.event}`
    await db.collection('analytics_daily').doc(counterId).set({
      date:  day,
      event: body.event,
      count: FieldValue.increment(1),
    }, { merge: true })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[track]', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
