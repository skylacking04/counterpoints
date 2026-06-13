import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId } from '@/lib/youtube-transcript'
import { fetchTranscript } from '@/lib/youtube-captions'
import { fetchTranscriptViaYtDlp } from '@/lib/ytdlp-transcript'
import { getCachedTranscript, setCachedTranscript } from '@/lib/transcript-cache'
import { GoogleGenAI } from '@google/genai'
import type { TranscriptEntry } from '@/lib/youtube-transcript'

export interface VideoMeta {
  title: string
  description: string
  channelTitle: string
  thumbnailUrl: string
  durationMs: number
}

// Parse an ISO 8601 duration (e.g. "PT1M13S") to milliseconds
function iso8601ToMs(d: string): number {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return ((+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0))) * 1000
}

// Gemini transcribes accurately but estimates timestamps that drift past the real
// video length. Linearly rescale to fit 0→duration. Accurate captions pass through.
function normalizeTimestamps(entries: TranscriptEntry[], durationMs: number): TranscriptEntry[] {
  if (!durationMs || entries.length === 0) return entries
  const maxOffset = Math.max(...entries.map(e => e.offsetMs))
  if (maxOffset <= durationMs * 1.05) return entries
  const scale = durationMs / maxOffset
  console.log(`[youtube] rescaling timestamps: maxOffset=${maxOffset}ms duration=${durationMs}ms scale=${scale.toFixed(3)}`)
  return entries.map(e => ({
    ...e,
    offsetMs:   Math.round(e.offsetMs * scale),
    durationMs: Math.round(e.durationMs * scale),
  }))
}

async function fetchVideoMeta(videoId: string): Promise<VideoMeta | null> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return null
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`
    const res = await fetch(url)
    const data = await res.json() as { items?: { snippet: { title: string; description: string; channelTitle: string; thumbnails: { medium?: { url: string } } }; contentDetails?: { duration?: string } }[] }
    const item = data.items?.[0]
    if (!item?.snippet) return null
    return {
      title:        item.snippet.title,
      description:  item.snippet.description.slice(0, 600),
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? '',
      durationMs:   iso8601ToMs(item.contentDetails?.duration ?? ''),
    }
  } catch {
    return null
  }
}

async function fetchTranscriptViaGemini(videoId: string, meta: VideoMeta | null): Promise<TranscriptEntry[]> {
  // Vertex AI does not support YouTube URLs in fileData — must use Gemini Developer API here.
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) { console.warn('[gemini-transcript] no GOOGLE_AI_API_KEY'); return [] }
  try {
    const devAi = new GoogleGenAI({ apiKey })
    const result = await devAi.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [
        { fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}` } },
        {
          text: `Video title: "${meta?.title ?? ''}"
${meta?.durationMs ? `The video is ${Math.round(meta.durationMs / 1000)} seconds long. All "o" (offsetMs) values MUST fall between 0 and ${meta.durationMs} and increase monotonically. Distribute timestamps evenly across the full duration.` : ''}
Transcribe the spoken dialog. Return compact JSON array: [{"t":"text","o":ms,"d":ms}].
"t"=spoken text, "o"=offsetMs from start in milliseconds, "d"=durationMs.
One phrase per item (~5-8 seconds each), cover as much as possible. Return ONLY the JSON array, no markdown fences.`,
        },
      ]}],
      config: { maxOutputTokens: 8192 },
    })

    const raw = result.text ?? ''
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let parsed: TranscriptEntry[] | null = null
    try {
      parsed = JSON.parse(clean) as TranscriptEntry[]
    } catch {
      const lastComplete = clean.lastIndexOf('},')
      if (lastComplete > 0) {
        try { parsed = JSON.parse(clean.slice(0, lastComplete + 1) + ']') as TranscriptEntry[] } catch { /* ignore */ }
      }
    }

    if (!parsed || !Array.isArray(parsed)) {
      console.error('[gemini-transcript] failed to parse JSON for', videoId)
      return []
    }
    const normalized = (parsed as unknown as { t?: string; text?: string; o?: number; offsetMs?: number; d?: number; durationMs?: number }[]).map(e => ({
      text:       e.text ?? e.t ?? '',
      offsetMs:   e.offsetMs ?? e.o ?? 0,
      durationMs: e.durationMs ?? e.d ?? 5000,
    })).filter(e => e.text)
    console.log(`[gemini-transcript] fetched ${normalized.length} entries for ${videoId}`)
    return normalized
  } catch (e) {
    console.error('[gemini-transcript] failed:', e)
    return []
  }
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url') ?? ''
  const id       = req.nextUrl.searchParams.get('id') ?? extractVideoId(urlParam) ?? ''
  const metaOnly = req.nextUrl.searchParams.get('meta') === '1'

  if (!id) return NextResponse.json({ error: 'No video ID' }, { status: 400 })

  // Stage 1: metadata-only (fast path, <500ms)
  if (metaOnly) {
    const meta = await fetchVideoMeta(id)
    return NextResponse.json({ videoId: id, meta })
  }

  // Stage 2: full transcript
  // ?quick=1 returns InnerTube only (no Gemini fallback) for fast first-paint
  // ?stage2=1 skips InnerTube (already tried in quick) and goes straight to yt-dlp → Gemini
  const quickOnly = req.nextUrl.searchParams.get('quick') === '1'
  const stage2    = req.nextUrl.searchParams.get('stage2') === '1'

  // Check Firestore transcript cache first (cross-user, 7-day TTL) — including quick path,
  // so any previously-loaded video returns instantly.
  const cached = await getCachedTranscript(id)
  if (cached && cached.length > 0) {
    const meta = await fetchVideoMeta(id)
    return NextResponse.json({ videoId: id, meta, transcript: cached, isLive: false, source: 'cache' })
  }

  // Fetch metadata always; InnerTube transcript unless this is the stage2 (post-quick) request
  const [meta, ytResult] = await Promise.all([
    fetchVideoMeta(id),
    stage2 ? Promise.resolve({ entries: [] as TranscriptEntry[], isLive: false }) : fetchTranscript(id),
  ])

  let transcript = ytResult.entries
  const isLive = ytResult.isLive
  let source = transcript.length > 0 ? 'youtube' : 'empty'

  // (InnerTube-via-proxy retry removed — undici's proxy returns a 407 XML page on Cloud Run
  // for unknown env reasons, while yt-dlp via the same proxy works reliably. yt-dlp covers it.)

  // Steps 2-3: slow fallbacks — only in full/stage2 (never in quick, which must stay fast)
  if (transcript.length === 0 && !isLive && !quickOnly) {
    // yt-dlp via proxy + cookies (~3-10s, real captions)
    console.log(`[youtube] InnerTube empty for ${id}, trying yt-dlp`)
    transcript = await fetchTranscriptViaYtDlp(id)
    if (transcript.length > 0) {
      source = 'ytdlp'
    } else if (!meta?.durationMs) {
      // No real metadata → video is unavailable/private/region-blocked. Skip Gemini, which
      // would otherwise HALLUCINATE a fake generic transcript ("Hello and welcome…").
      console.log(`[youtube] no captions and no metadata for ${id} — skipping Gemini (would hallucinate)`)
    } else {
      // Last resort: Gemini watches the video (~30-60s, cached after)
      console.log(`[youtube] yt-dlp empty for ${id}, trying Gemini`)
      const timeout = new Promise<typeof transcript>(resolve => setTimeout(() => resolve([]), 45_000))
      transcript = await Promise.race([fetchTranscriptViaGemini(id, meta), timeout])
      if (transcript.length === 0) {
        console.log(`[youtube] Gemini returned empty or timed out for ${id}`)
      } else {
        source = 'gemini'
      }
    }
  }

  // Anchor ONLY Gemini output to the real duration (it estimates timestamps that drift).
  // Real captions (youtube/ytdlp) are ground truth and must never be rescaled.
  if (source === 'gemini') {
    transcript = normalizeTimestamps(transcript, meta?.durationMs ?? 0)
  }

  // Populate cache for future users (fire-and-forget)
  if (transcript.length > 0 && !isLive) {
    setCachedTranscript(id, transcript)
  }

  return NextResponse.json({ videoId: id, meta, transcript, isLive, source })
}
