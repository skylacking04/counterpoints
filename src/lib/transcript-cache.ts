import { getDb } from '@/lib/firebase-admin'
import type { TranscriptEntry } from '@/lib/youtube-transcript'

const COLL = 'cp_transcripts'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function getCachedTranscript(videoId: string): Promise<TranscriptEntry[] | null> {
  try {
    const doc = await getDb().collection(COLL).doc(videoId).get()
    if (!doc.exists) return null
    const d = doc.data()!
    if (Date.now() - (d.cachedAt as number) > TTL_MS) return null
    console.log(`[transcript-cache] hit for ${videoId}`)
    return d.transcript as TranscriptEntry[]
  } catch (e) {
    console.error('[transcript-cache] read failed', e)
    return null
  }
}

export async function setCachedTranscript(videoId: string, transcript: TranscriptEntry[]): Promise<void> {
  try {
    await getDb().collection(COLL).doc(videoId).set({ videoId, transcript, cachedAt: Date.now() })
    console.log(`[transcript-cache] stored ${transcript.length} entries for ${videoId}`)
  } catch (e) {
    console.error('[transcript-cache] write failed', e)
  }
}
