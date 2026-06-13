import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { extractVideoId } from '@/lib/youtube-transcript'
import { fetchTranscript } from '@/lib/youtube-captions'
import { transcribeWithTimestamps } from '@/lib/groq'
import { extractAudio, splitAudio, cleanup } from '@/lib/audio-extract'
import { getDb } from '@/lib/firebase-admin'
import { makeAssetKey, uploadAudio, uploadJson, audioObject, transcriptObject } from '@/lib/storage'
import { addHistory } from '@/lib/users'
import type { StoredTranscript, TranscriptSegment } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 800

const COLLECTION = 'cp_transcripts'
const hashUrl = (url: string) => createHash('sha1').update(url.trim()).digest('hex')

// Stored docs drop per-word arrays to stay well under Firestore's 1MB doc cap on long videos.
// Highlighting only needs segment start/end; words are returned live but not persisted.
function slim(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.map(({ startMs, endMs, text, speaker }) => ({ startMs, endMs, text, speaker: speaker ?? null }))
}

async function ccTranscript(videoId: string | null): Promise<TranscriptSegment[]> {
  if (!videoId) return []
  try {
    const { entries } = await fetchTranscript(videoId)
    return entries.map(e => ({
      startMs: e.offsetMs,
      endMs: e.offsetMs + (e.durationMs || 4000),
      text: e.text,
      speaker: null,
    }))
  } catch { return [] }
}

// Returns the audioPath + workDir so the caller can upload the mp3 to GCS before cleanup.
async function whisperTranscript(url: string): Promise<{ segments: TranscriptSegment[]; durationMs: number; meta: { title: string | null; uploader: string | null }; language?: string; audioPath: string; workDir: string }> {
  const ex = await extractAudio(url)
  try {
    const chunks = await splitAudio(ex.audioPath, ex.durationMs)
    const segments: TranscriptSegment[] = []
    let language: string | undefined
    // Sequential — respects Groq free-tier rate limits and keeps memory low.
    for (const chunk of chunks) {
      const r = await transcribeWithTimestamps(chunk.buffer, 'chunk.mp3', 'audio/mpeg', chunk.startMs)
      if (r.language && !language) language = r.language
      segments.push(...r.segments)
    }
    segments.sort((a, b) => a.startMs - b.startMs)
    return { segments, durationMs: ex.durationMs, meta: ex.meta, language, audioPath: ex.audioPath, workDir: ex.workDir }
  } catch (e) {
    await cleanup(ex.workDir)  // clean up on failure; success path cleans up in the caller after upload
    throw e
  }
}

async function persistDoc(doc: StoredTranscript): Promise<void> {
  await getDb().collection(COLLECTION).doc(hashUrl(doc.url)).set({
    ...doc,
    ccSegments: slim(doc.ccSegments),
    whisperSegments: slim(doc.whisperSegments),
  })
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'No url' }, { status: 400 })
  const snap = await getDb().collection(COLLECTION).doc(hashUrl(url)).get()
  if (!snap.exists) return NextResponse.json({ cached: false }, { status: 404 })
  return NextResponse.json({ cached: true, ...(snap.data() as StoredTranscript) })
}

export async function POST(req: NextRequest) {
  let url = '', userId: string | undefined
  try {
    const b = await req.json() as { url?: string; userId?: string }
    url = b.url ?? ''
    userId = b.userId
  } catch { /* ignore */ }
  if (!url.trim()) return NextResponse.json({ error: 'No url' }, { status: 400 })

  const videoId = extractVideoId(url)

  // Cache hit → return persisted transcript (recall path). Still stamp the user's history.
  const cached = await getDb().collection(COLLECTION).doc(hashUrl(url)).get()
  if (cached.exists) {
    const data = cached.data() as StoredTranscript
    await addHistory(userId, { urlHash: hashUrl(url), url, title: data.title, assetKey: data.assetKey, createdAt: Date.now() })
    return NextResponse.json({ cached: true, ...data })
  }

  // Run native CC + Whisper in parallel; neither blocks the other.
  const [cc, whisper] = await Promise.allSettled([
    ccTranscript(videoId),
    whisperTranscript(url),
  ])

  const ccSegments = cc.status === 'fulfilled' ? cc.value : []
  const w = whisper.status === 'fulfilled' ? whisper.value : null
  const whisperError = whisper.status === 'rejected' ? String(whisper.reason).slice(0, 300) : null

  // Hard-fail only when BOTH sources are empty. A blocked yt-dlp must not discard good captions.
  if (!w && ccSegments.length === 0) {
    return NextResponse.json(
      { error: 'transcription_failed', message: whisperError ?? 'No transcript from any source', ccSegments },
      { status: 502 },
    )
  }

  const createdAt = Date.now()
  const title = w?.meta.title ?? null
  const durationMs = w?.durationMs ?? (ccSegments.at(-1)?.endMs ?? 0)
  const assetKey = makeAssetKey(url, title, new Date(createdAt))

  // Upload the source audio + a self-describing transcript JSON to GCS (shared assetKey base name),
  // then clean up the temp dir. Best-effort: a storage failure must not lose the transcript.
  let audioUrl: string | null = null
  let audioObj: string | null = null
  if (w) {
    try {
      const up = await uploadAudio(assetKey, w.audioPath)
      audioUrl = up.url; audioObj = up.object
    } catch (e) { console.error('[transcribe-url] audio upload failed', e) }
    try {
      await uploadJson(assetKey, {
        assetKey, url, title, createdAt, durationMs,
        audioObject: audioObj ?? audioObject(assetKey),
        source: 'whisper', language: w.language ?? null,
        segments: slim(w.segments),
      })
    } catch (e) { console.error('[transcribe-url] json upload failed', e) }
    await cleanup(w.workDir)
  }

  const doc: StoredTranscript = {
    url,
    videoId,
    title,
    durationMs,
    audioUrl,
    assetKey,
    audioObject: audioObj,
    transcriptObject: w ? transcriptObject(assetKey) : null,
    language: w?.language ?? null,
    ccSegments,
    whisperSegments: w?.segments ?? [],
    speakerMap: {},
    createdAt,
  }

  // Persist (slimmed); return full segments (with words) in this response.
  try { await persistDoc(doc) } catch (e) { console.error('[transcribe-url] persist failed', e) }
  await addHistory(userId, { urlHash: hashUrl(url), url, title, assetKey, createdAt })

  return NextResponse.json({ cached: false, whisperError, ...doc })
}
