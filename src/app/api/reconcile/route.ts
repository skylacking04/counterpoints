import { NextRequest, NextResponse } from 'next/server'
import { callLLM } from '@/lib/llm'
import type { LLMSettings } from '@/types'

// Compare/contrast agent: reads the CC and live-audio transcripts of the SAME content and
// reconciles them — flags meaningful divergence and returns the more-accurate merged text.
// Only worth calling when both sources have content for the same span.
export async function POST(req: NextRequest) {
  const { ccText, liveText, settings } = await req.json() as {
    ccText?: string
    liveText?: string
    settings?: LLMSettings
  }

  const cc = (ccText ?? '').slice(0, 4000).trim()
  const live = (liveText ?? '').slice(0, 4000).trim()
  if (!cc || !live) return NextResponse.json({ merged: cc || live, notes: [], divergence: false })

  const prompt = `Two transcripts of the SAME audio were produced by different methods:
A) CAPTIONS (often auto-generated; may misspell names/numbers): """${cc}"""
B) LIVE WHISPER (audio transcription; may mis-hear words): """${live}"""

Reconcile them into the single most accurate transcript. Prefer whichever is clearer/correct per phrase.
Flag only MEANINGFUL factual divergences (different numbers, names, or claims) — ignore punctuation/casing.

Return JSON only (no fences):
{ "merged": "best combined transcript text", "divergence": true|false, "notes": ["short note on each meaningful discrepancy"] }`

  try {
    const raw = await callLLM([
      { role: 'system', content: 'You are a precise JSON-only transcript reconciliation assistant.' },
      { role: 'user', content: prompt },
    ], settings)
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean) as { merged?: string; divergence?: boolean; notes?: string[] }
    return NextResponse.json({
      merged: parsed.merged ?? `${cc}\n${live}`,
      divergence: !!parsed.divergence,
      notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, 5) : [],
    })
  } catch (err) {
    console.error('reconcile error', err)
    return NextResponse.json({ merged: cc || live, divergence: false, notes: [] })
  }
}
