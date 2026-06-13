import { NextRequest, NextResponse } from 'next/server'
import { callLLM } from '@/lib/llm'
import type { LLMSettings, SpectrumLens } from '@/types'

interface SourceEntry {
  tab: SpectrumLens
  source: string
  url: string
  quote: string
}

export interface CompareResult {
  sharedFacts: string
  whatTheyAgreeOn: string
  byLens: Partial<Record<SpectrumLens, LensBreakdown>>
  fullPicture: string
  whatMainstreamMissed?: string
  primarySourceLink?: string
}

interface LensBreakdown {
  emphasized: string
  buried: string
  quote: string
  source: string
}

export async function POST(req: NextRequest) {
  const { claim, sources, settings } = await req.json() as {
    claim: string
    sources: SourceEntry[]
    settings?: LLMSettings
  }

  if (!claim || !sources?.length) {
    return NextResponse.json({ error: 'missing claim or sources' }, { status: 400 })
  }

  // Build a readable summary of all available sources for Gemini to reason about
  const sourceSummary = sources.map(s =>
    `[${s.tab.toUpperCase()}] ${s.source}: "${s.quote}"`
  ).join('\n')

  const raw = await callLLM([
    {
      role: 'system',
      content: `You are a media analyst who compares how different outlets cover the same claim.
Identify what each side emphasizes, what they bury, and what the full picture looks like.
Respond with JSON only — no markdown.`,
    },
    {
      role: 'user',
      content: `Claim being discussed: "${claim}"

How different sources cover it:
${sourceSummary}

Return JSON:
{
  "sharedFacts": "1-2 sentence core factual basis all sources implicitly agree on",
  "whatTheyAgreeOn": "1 sentence — common ground across the spectrum",
  "byLens": {
    "left":   { "emphasized": "what left-leaning sources stress", "buried": "what they downplay or omit", "quote": "most representative quote", "source": "outlet name" },
    "center": { "emphasized": "...", "buried": "...", "quote": "...", "source": "..." },
    "right":  { "emphasized": "...", "buried": "...", "quote": "...", "source": "..." },
    "alt":    { "emphasized": "...", "buried": "...", "quote": "...", "source": "..." }
  },
  "fullPicture": "2-3 sentence synthesis of what the COMPLETE story looks like when you combine all sources",
  "whatMainstreamMissed": "1 sentence — what mainstream left/right both missed that alt/independent media caught (or null if nothing)"
}

Only include lenses for which you have source data. Return null for fields you can't fill.`,
    },
  ], settings)

  try {
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(clean) as CompareResult
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({
      sharedFacts: 'Multiple sources found — see individual tabs for details.',
      whatTheyAgreeOn: '',
      byLens: {},
      fullPicture: raw.slice(0, 400),
      whatMainstreamMissed: undefined,
    } satisfies CompareResult)
  }
}
