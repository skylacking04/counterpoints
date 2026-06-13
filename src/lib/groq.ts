import type { TranscriptSegment, TranscriptWord } from '@/types'

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const Groq = (await import('groq-sdk')).default
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' })
  const transcription = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3-turbo',
    response_format: 'verbose_json',
    timestamp_granularities: ['word'],
  })
  return transcription.text
}

interface GroqVerboseSegment { start: number; end: number; text: string }
interface GroqVerboseWord { word: string; start: number; end: number }
interface GroqVerbose {
  language?: string
  duration?: number
  segments?: GroqVerboseSegment[]
  words?: GroqVerboseWord[]
}

/**
 * Transcribe an audio buffer with real segment + word timestamps.
 * `baseOffsetMs` is added to every timestamp so chunked audio stitches into one
 * continuous timeline (chunk N starts at N * chunkSec).
 */
export async function transcribeWithTimestamps(
  audio: Buffer,
  filename = 'chunk.mp3',
  mimeType = 'audio/mpeg',
  baseOffsetMs = 0,
): Promise<{ segments: TranscriptSegment[]; language?: string }> {
  const Groq = (await import('groq-sdk')).default
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const file = new File([new Uint8Array(audio)], filename, { type: mimeType })
  const res = (await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment', 'word'],
  })) as unknown as GroqVerbose

  const allWords: TranscriptWord[] = (res.words ?? []).map(w => ({
    w: w.word,
    startMs: Math.round(w.start * 1000) + baseOffsetMs,
    endMs: Math.round(w.end * 1000) + baseOffsetMs,
  }))

  const segments: TranscriptSegment[] = (res.segments ?? []).map(s => {
    const startMs = Math.round(s.start * 1000) + baseOffsetMs
    const endMs = Math.round(s.end * 1000) + baseOffsetMs
    return {
      startMs,
      endMs,
      text: s.text.trim(),
      speaker: null,
      words: allWords.filter(w => w.startMs >= startMs - 50 && w.endMs <= endMs + 50),
    }
  }).filter(s => s.text)

  return { segments, language: res.language }
}
