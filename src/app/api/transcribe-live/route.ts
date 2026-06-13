import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { extractVideoId } from '@/lib/youtube-transcript'
import { transcribeWithTimestamps } from '@/lib/groq'
import { resolveStreamUrl, grabLiveWindow } from '@/lib/audio-extract'
import { getDb } from '@/lib/firebase-admin'
import { addHistory } from '@/lib/users'
import type { TranscriptSegment } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 120

const COLLECTION = 'cp_transcripts'
const WINDOW_SEC = 20
const hashUrl = (url: string) => createHash('sha1').update(url.trim()).digest('hex')

// Pull one live-edge window, transcribe it, append to the stored transcript, return the new segments.
// Stateless: the client drives the loop and passes back the running offset as `sinceMs`.
export async function POST(req: NextRequest) {
  let url = '', sinceMs = 0, userId: string | undefined
  try {
    const b = await req.json() as { url?: string; sinceMs?: number; userId?: string }
    url = b.url ?? ''
    sinceMs = Math.max(0, b.sinceMs ?? 0)
    userId = b.userId
  } catch { /* ignore */ }
  if (!url.trim()) return NextResponse.json({ error: 'No url' }, { status: 400 })

  try {
    const streamUrl = await resolveStreamUrl(url)
    const buf = await grabLiveWindow(streamUrl, WINDOW_SEC)
    const { segments, language } = await transcribeWithTimestamps(buf, 'live.mp3', 'audio/mpeg', sinceMs)

    const slim: TranscriptSegment[] = segments.map(({ startMs, endMs, text, speaker }) => ({
      startMs, endMs, text, speaker: speaker ?? null,
    }))

    // Append into the same cp_transcripts doc so a live session accumulates a retrievable transcript.
    if (slim.length) {
      const ref = getDb().collection(COLLECTION).doc(hashUrl(url))
      await ref.set({
        url,
        videoId: extractVideoId(url),
        isLive: true,
        language: language ?? null,
        updatedAt: Date.now(),
        whisperSegments: FieldValue.arrayUnion(...slim),
      }, { merge: true }).catch(e => console.error('[transcribe-live] persist failed', e))

      // Stamp the user's history once (first window with content); merge keeps it idempotent.
      if (sinceMs === 0) {
        await addHistory(userId, { urlHash: hashUrl(url), url, title: null, createdAt: Date.now() })
      }
    }

    return NextResponse.json({ segments: slim, nextSinceMs: sinceMs + WINDOW_SEC * 1000, language })
  } catch (e) {
    return NextResponse.json({ error: 'live_capture_failed', message: String(e).slice(0, 300) }, { status: 502 })
  }
}
