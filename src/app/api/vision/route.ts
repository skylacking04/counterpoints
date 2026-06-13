import { NextRequest, NextResponse } from 'next/server'
import { ai } from '@/lib/genai'
import type { VisionSnapshot } from '@/types'

export async function POST(req: NextRequest) {
  const { imageBase64 } = await req.json() as { imageBase64: string }
  if (!imageBase64) return NextResponse.json({ error: 'No image' }, { status: 400 })

  try {
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '')

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user' as const, parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
        {
          text: `Analyze this video frame for visible stress or confidence signals in the speaker.
Look for: gaze direction (direct vs. avoidance), lip compression, micro-tension around eyes, body lean (forward=engaged, back=defensive), hand-to-face gestures (nose touch, mouth cover).
This is entertainment analysis of public broadcast content only.
Return JSON only: { "stressLevel": "low"|"medium"|"high", "signals": ["signal1", "signal2"], "confidence": 0.0-1.0 }
If no face is visible, return { "stressLevel": "low", "signals": [], "confidence": 0 }`,
        },
      ]}],
    })

    const raw = result.text ?? ''
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean) as VisionSnapshot
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('vision error', err)
    return NextResponse.json({ stressLevel: 'low', signals: [], confidence: 0 } satisfies VisionSnapshot)
  }
}
