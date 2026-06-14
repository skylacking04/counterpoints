import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export const runtime = 'nodejs'

// Simple in-process IP→geo cache so we don't hammer ip-api on every event
const geoCache = new Map<string, { city: string | null; region: string | null; country: string | null }>()

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    null
  )
}

async function geoFromIp(ip: string | null): Promise<{ city: string | null; region: string | null; country: string | null }> {
  if (!ip || ip === '127.0.0.1' || ip.startsWith('::')) return { city: null, region: null, country: null }
  if (geoCache.has(ip)) return geoCache.get(ip)!
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=city,regionName,country,status`, { signal: AbortSignal.timeout(2000) })
    const d = await res.json() as { status: string; city?: string; regionName?: string; country?: string }
    const loc = d.status === 'success'
      ? { city: d.city ?? null, region: d.regionName ?? null, country: d.country ?? null }
      : { city: null, region: null, country: null }
    geoCache.set(ip, loc)
    return loc
  } catch {
    return { city: null, region: null, country: null }
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

    const ip = clientIp(req)
    const location = await geoFromIp(ip)
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
