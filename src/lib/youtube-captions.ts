import { fetch as undiciFetch, ProxyAgent } from 'undici'
import type { TranscriptEntry, FetchTranscriptResult } from '@/lib/youtube-transcript'

// Server-only: fetches YouTube captions via InnerTube, optionally through a residential
// proxy. YouTube blocks datacenter IPs, so { proxy: true } retries via the proxy.
type FetchOpts = { proxy?: boolean }

// Build a ProxyAgent that explicitly sends Basic proxy-auth. undici does NOT reliably
// parse user:pass from the proxy URI (it returns a 407 XML error page), so set the
// Proxy-Authorization token ourselves.
function makeProxyDispatcher(proxyUrl: string): ProxyAgent {
  const u = new URL(proxyUrl)
  if (u.username || u.password) {
    const user = decodeURIComponent(u.username)
    const pass = decodeURIComponent(u.password)
    const token = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
    return new ProxyAgent({ uri: `${u.protocol}//${u.host}`, token })
  }
  return new ProxyAgent(proxyUrl)
}

// One fetch helper that routes through the residential proxy when requested.
function doFetch(url: string, init: Parameters<typeof undiciFetch>[1], useProxy: boolean) {
  const proxyUrl = process.env.PROXY_URL
  if (useProxy && proxyUrl) {
    return undiciFetch(url, { ...init, dispatcher: makeProxyDispatcher(proxyUrl) })
  }
  return undiciFetch(url, init)
}

export async function fetchTranscript(videoId: string, opts: FetchOpts = {}): Promise<FetchTranscriptResult> {
  const useProxy = !!opts.proxy
  // Try InnerTube API first (ANDROID client — fast when not IP-blocked)
  try {
    const body = {
      context: {
        client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 34 },
      },
      videoId,
    }
    const resp = await doFetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
        'X-YouTube-Client-Name': '3',
        'X-YouTube-Client-Version': '20.10.38',
        'Accept-Language': 'en-US',
      },
      body: JSON.stringify(body),
    }, useProxy)
    const rawBody = await resp.text()
    if (useProxy && (!rawBody || rawBody[0] === '<')) {
      console.error(`[fetchTranscript] proxy returned non-JSON (status ${resp.status}):`, rawBody.slice(0, 200))
    }
    if (resp.ok) {
      const data = JSON.parse(rawBody) as {
        videoDetails?: { isLive?: boolean; isLiveContent?: boolean }
        captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: { baseUrl?: string }[] } }
      }
      const isLive = !!(data?.videoDetails?.isLive)  // isLiveContent=true on past streams too — don't treat as live
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks
      const enTrack = tracks?.find(t => t.baseUrl?.includes('lang=en')) ?? tracks?.[0]
      if (enTrack?.baseUrl) {
        const xmlResp = await doFetch(`${enTrack.baseUrl}&fmt=json3`, {}, useProxy)
        if (xmlResp.ok) {
          const xml = await xmlResp.json() as { events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[] }
          const events = xml?.events?.filter(e => e.segs) ?? []
          const entries: TranscriptEntry[] = events.map(e => ({
            text:       (e.segs ?? []).map(s => s.utf8 ?? '').join('').replace(/\n/g, ' ').trim(),
            offsetMs:   e.tStartMs ?? 0,
            durationMs: e.dDurationMs ?? 0,
          })).filter(e => e.text)
          return { entries, isLive }
        }
      }
      if (isLive) return { entries: [], isLive: true }
    }
  } catch (e) {
    console.error(`[fetchTranscript] InnerTube failed (proxy=${useProxy}):`, (e as Error).message)
  }

  // Fallback to youtube-transcript package (direct only — it has no proxy support)
  if (!useProxy) {
    try {
      const { YoutubeTranscript } = await import('youtube-transcript')
      const raw = await YoutubeTranscript.fetchTranscript(videoId)
      const entries = raw.map(r => ({
        text:       r.text,
        offsetMs:   Math.round(r.offset * 1000),
        durationMs: Math.round(r.duration * 1000),
      }))
      return { entries, isLive: false }
    } catch (e) {
      console.error('[fetchTranscript] youtube-transcript fallback failed:', e)
    }
  }
  return { entries: [], isLive: false }
}
