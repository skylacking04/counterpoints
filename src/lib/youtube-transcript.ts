export interface TranscriptEntry {
  text: string
  offsetMs: number
  durationMs: number
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&#]+)/,
    /youtu\.be\/([^?#]+)/,
    /embed\/([^?#]+)/,
    /shorts\/([^?#]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

export interface FetchTranscriptResult {
  entries: TranscriptEntry[]
  isLive: boolean
}

// NOTE: fetchTranscript moved to '@/lib/youtube-captions' (server-only) so it can use
// undici ProxyAgent for residential-proxy retries without breaking the client bundle.

export function findTimestampForTopic(
  transcript: TranscriptEntry[],
  topicKeywords: string[]
): number | null {
  const query = topicKeywords.join(' ').toLowerCase()
  const words = query.split(/\s+/)

  let bestScore = 0
  let bestOffset: number | null = null

  for (let i = 0; i < transcript.length; i++) {
    const window = transcript.slice(i, i + 5).map(t => t.text).join(' ').toLowerCase()
    const score = words.filter(w => window.includes(w)).length
    if (score > bestScore) {
      bestScore = score
      bestOffset = transcript[i].offsetMs
    }
  }

  return bestScore >= Math.ceil(words.length * 0.4) ? bestOffset : null
}

export function getWindowAroundTimestamp(
  transcript: TranscriptEntry[],
  offsetMs: number,
  radiusMs = 30000
): string {
  return transcript
    .filter(t => Math.abs(t.offsetMs - offsetMs) <= radiusMs)
    .map(t => t.text)
    .join(' ')
}
