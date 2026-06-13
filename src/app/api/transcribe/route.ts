import { NextRequest, NextResponse } from 'next/server'
import { ai } from '@/lib/genai'
import { transcribeWithTimestamps } from '@/lib/groq'

// Gemini Flash audio transcription via Vertex AI — no API key, uses Cloud Run service account.
// Only called for tab audio capture. YouTube captions come free via youtube-transcript.
async function transcribeWithGemini(audioBlob: Blob): Promise<string> {
  const arrayBuffer = await audioBlob.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user' as const, parts: [
      { inlineData: { mimeType: 'audio/webm', data: base64 } },
      { text: 'Transcribe this audio accurately. Return only the spoken text, no timestamps, no labels.' },
    ]}],
  })
  return result.text?.trim() ?? ''
}

// Groq Whisper fallback (if GROQ_API_KEY is set by user in settings)
async function transcribeWithGroq(audioBlob: Blob): Promise<string> {
  const Groq = (await import('groq-sdk')).default
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' })
  const res = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3-turbo',
  })
  return res.text
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('audio') as Blob | null
  if (!file) return NextResponse.json({ error: 'No audio' }, { status: 400 })

  try {
    // Preferred: Groq Whisper with real per-segment timestamps (verbose_json). Each chunk's
    // segments start at 0; the client offsets them by capture-elapsed time. Falls back to plain text.
    if (process.env.GROQ_API_KEY) {
      const buf = Buffer.from(await file.arrayBuffer())
      const { segments } = await transcribeWithTimestamps(buf, 'chunk.webm', file.type || 'audio/webm', 0)
      const text = segments.map(s => s.text).join(' ').trim()
      return NextResponse.json({ text, segments })
    }
    const text = await transcribeWithGemini(file)
    return NextResponse.json({ text, segments: [] })
  } catch (err) {
    console.error('transcribe error', err)
    // Last-resort fallback to plain Groq text so a verbose_json hiccup doesn't drop the chunk
    try {
      const text = process.env.GROQ_API_KEY ? await transcribeWithGroq(file) : await transcribeWithGemini(file)
      return NextResponse.json({ text, segments: [] })
    } catch {
      return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
    }
  }
}
