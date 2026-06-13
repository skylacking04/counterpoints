import { TRUSTED_CHANNELS } from './trusted-channels'
import { findTimestampForTopic, getWindowAroundTimestamp } from './youtube-transcript'
import { fetchTranscript } from './youtube-captions'
import { GoogleGenAI } from '@google/genai'

// Gemini fallback: fetch a short transcript + find the timestamp for a topic
// Uses Gemini Developer API (not Vertex AI) — only the Developer API supports YouTube URLs in fileData.
async function fetchTranscriptViaGemini(videoId: string, topicQuery: string): Promise<{ timestampSec: number | null; captionWindow: string }> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) return { timestampSec: null, captionWindow: '' }
  try {
    const devAi = new GoogleGenAI({ apiKey })
    const result = await devAi.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [
        { fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}` } },
        { text: `Topic to find: "${topicQuery}"

Does this video discuss this topic? If yes:
1. At what minute:second timestamp is it first discussed?
2. Quote the exact words said at that moment (2-3 sentences).

Return JSON only: {"found": true/false, "timestampSec": number_or_null, "quote": "exact words"}` },
      ]}],
      config: { maxOutputTokens: 512 },
    })
    const text = result.text ?? ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean) as { found: boolean; timestampSec: number | null; quote: string }
    if (!parsed.found) return { timestampSec: null, captionWindow: '' }
    return { timestampSec: parsed.timestampSec, captionWindow: parsed.quote ?? '' }
  } catch {
    return { timestampSec: null, captionWindow: '' }
  }
}

export interface VideoResult {
  videoId: string
  title: string
  channelName: string
  thumbnailUrl: string
  timestampSec: number | null
  captionWindow: string
  watchUrl: string
}

export async function searchTrustedChannels(
  query: string,
  channelIds?: string[],   // if provided, only search these channels; otherwise search all
): Promise<VideoResult[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return []

  const channels = channelIds?.length
    ? TRUSTED_CHANNELS.filter(c => channelIds.includes(c.channelId))
    : TRUSTED_CHANNELS

  const results: VideoResult[] = []

  await Promise.all(
    channels.map(async (ch) => {
      try {
        const url = new URL('https://www.googleapis.com/youtube/v3/search')
        url.searchParams.set('part', 'snippet')
        url.searchParams.set('channelId', ch.channelId)
        url.searchParams.set('q', query)
        url.searchParams.set('type', 'video')
        url.searchParams.set('maxResults', '2')
        url.searchParams.set('order', 'relevance')
        url.searchParams.set('key', apiKey)

        const res = await fetch(url.toString())
        const data = await res.json() as { items?: YoutubeItem[] }

        for (const item of data.items ?? []) {
          const videoId = item.id.videoId
          const { entries: transcript } = await fetchTranscript(videoId)

          let timestampSec: number | null = null
          let captionWindow = ''

          if (transcript.length > 0) {
            // YouTube transcript available — use keyword search
            const topicWords = query.split(/\s+/).filter(w => w.length > 3)
            const offsetMs = findTimestampForTopic(transcript, topicWords)
            if (offsetMs !== null) {
              timestampSec = Math.round(offsetMs / 1000)
              captionWindow = getWindowAroundTimestamp(transcript, offsetMs)
            }
          } else {
            // Cloud Run blocks YouTube transcript IPs — use Gemini to find timestamp
            const gemini = await fetchTranscriptViaGemini(videoId, query)
            timestampSec   = gemini.timestampSec
            captionWindow  = gemini.captionWindow
          }

          results.push({
            videoId,
            title:        item.snippet.title,
            channelName:  ch.name,
            thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            timestampSec,
            captionWindow,
            watchUrl: timestampSec
              ? `https://www.youtube.com/watch?v=${videoId}&t=${timestampSec}s`
              : `https://www.youtube.com/watch?v=${videoId}`,
          })
        }
      } catch {
        // skip failed channel
      }
    })
  )

  return results.filter(r => r.captionWindow.length > 0).slice(0, 4)
}

interface YoutubeItem {
  id: { videoId: string }
  snippet: {
    title: string
    thumbnails?: { medium?: { url: string } }
  }
}
