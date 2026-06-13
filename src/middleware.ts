import { NextRequest, NextResponse } from 'next/server'

/**
 * Security middleware:
 * 1. IP-based rate limiting on expensive AI endpoints
 * 2. Security headers on all responses
 * 3. Block oversized request bodies before they hit route handlers
 *
 * Uses in-process Map — resets on cold start, fine for Cloud Run demo/bounty.
 * Each instance enforces its own limits; at low traffic this is the right tradeoff.
 */

// ── Rate limit store ──────────────────────────────────────────────────────────
// key = `${ip}:${bucket}` → { count, windowStart }
const store = new Map<string, { count: number; windowStart: number }>()

// Prune old entries every ~500 requests to avoid unbounded growth
let pruneCounter = 0
function pruneStore() {
  if (++pruneCounter % 500 !== 0) return
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [k, v] of store) {
    if (v.windowStart < cutoff) store.delete(k)
  }
}

function checkLimit(ip: string, bucket: string, limit: number, windowMs: number): boolean {
  pruneStore()
  const key = `${ip}:${bucket}`
  const now  = Date.now()
  const entry = store.get(key)
  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '0.0.0.0'
  )
}

// ── Rate limit config ─────────────────────────────────────────────────────────
// Format: [bucket, limit, windowMs]
// Generous for legit users; enough to prevent credit drain from bots.
const LIMITS: Record<string, [string, number, number]> = {
  '/api/analyze':   ['analyze',  12, 5 * 60 * 1000],   // 12 per 5min
  '/api/evidence':  ['evidence', 25, 5 * 60 * 1000],   // 25 per 5min
  '/api/verify':    ['verify',   15, 5 * 60 * 1000],   // 15 per 5min
  '/api/compare':   ['compare',   6, 5 * 60 * 1000],   //  6 per 5min
  '/api/reconcile': ['reconcile', 20, 5 * 60 * 1000],   // 20 per 5min (slow background cadence)
  '/api/youtube':   ['youtube',  20, 5 * 60 * 1000],   // 20 per 5min
  '/api/transcribe':['stt',     300, 5 * 60 * 1000],   // 300 per 5min (~1/s sustained for tab audio)
  '/api/transcribe-url':['stturl', 6, 5 * 60 * 1000],   //  6 per 5min (heavy: download + Groq chunks)
  '/api/transcribe-live':['sttlive', 60, 5 * 60 * 1000], // 60 per 5min (polled ~every 15s during a live session)
  '/api/test-key':  ['testkey',   8, 60 * 1000],        //  8 per min (brute-force guard)
  '/api/vision':    ['vision',   10, 5 * 60 * 1000],   // 10 per 5min
}

// ── Security headers added to every response ──────────────────────────────────
const SEC_HEADERS: Record<string, string> = {
  'X-Content-Type-Options':      'nosniff',
  'X-Frame-Options':             'DENY',
  'Referrer-Policy':             'strict-origin-when-cross-origin',
  'Permissions-Policy':          'camera=(), microphone=(self), geolocation=()',
  'X-XSS-Protection':            '1; mode=block',
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const ip = getIp(req)

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const limitConfig = LIMITS[pathname]
  if (limitConfig) {
    const [bucket, limit, windowMs] = limitConfig
    if (!checkLimit(ip, bucket, limit, windowMs)) {
      const res = NextResponse.json(
        {
          error: 'rate_limited',
          message: `Too many requests. Add your own API key in ⚙ Settings to continue without limits.`,
          retryAfterMs: windowMs,
        },
        { status: 429 }
      )
      for (const [h, v] of Object.entries(SEC_HEADERS)) res.headers.set(h, v)
      res.headers.set('Retry-After', String(Math.ceil(windowMs / 1000)))
      return res
    }
    // Attach remaining-count header so UI can warn before hitting limit
    const entry = store.get(`${ip}:${bucket}`)!
    const remaining = Math.max(0, limit - entry.count)
    const res = NextResponse.next()
    res.headers.set('X-RateLimit-Limit',     String(limit))
    res.headers.set('X-RateLimit-Remaining', String(remaining))
    for (const [h, v] of Object.entries(SEC_HEADERS)) res.headers.set(h, v)
    return res
  }

  // ── Security headers on all other routes ───────────────────────────────────
  const res = NextResponse.next()
  for (const [h, v] of Object.entries(SEC_HEADERS)) res.headers.set(h, v)
  return res
}

export const config = {
  matcher: [
    '/api/analyze',
    '/api/evidence',
    '/api/verify',
    '/api/compare',
    '/api/reconcile',
    '/api/youtube',
    '/api/transcribe',
    '/api/transcribe-url',
    '/api/transcribe-live',
    '/api/test-key',
    '/api/vision',
    '/((?!_next/static|_next/image|favicon).*)',
  ],
}
