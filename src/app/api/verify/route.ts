import { NextRequest, NextResponse } from 'next/server'
import { callLLM } from '@/lib/llm'
import { searchGrokNotes } from '@/lib/grok-notes'
import { searchWithGemini } from '@/lib/gemini-search'
import type { LLMSettings, Verdict } from '@/types'

export async function POST(req: NextRequest) {
  const { text, settings } = await req.json() as { text: string; settings?: LLMSettings }
  if (!text?.trim()) return NextResponse.json({ error: 'no text' }, { status: 400 })

  // Run X community notes + Gemini search in parallel
  const [grokResult, geminiResults] = await Promise.all([
    searchGrokNotes(text),
    searchWithGemini(text, 'center', ['reuters.com', 'apnews.com', 'factcheck.org', 'politifact.com', 'snopes.com'], 3),
  ])

  const communityNotes = grokResult?.notes ?? []
  const xPosts        = grokResult?.posts ?? []

  // Assemble evidence string — community notes are the gold standard, lead with them
  const notesText = communityNotes.map(n => `X Community Note: "${n.text}"`).join('\n')
  const webText   = geminiResults.map(r => `${r.title}: "${r.markdown}"`).join('\n')
  const evidence  = [notesText, webText].filter(Boolean).join('\n\n')

  const verdictRaw = await callLLM([
    { role: 'system', content: 'Respond with JSON only: { "verdict": "TRUE"|"MISLEADING"|"FALSE"|"UNVERIFIED", "summary": "2-3 sentences", "confidence": "high"|"medium"|"low" }. CALIBRATION: Absence of evidence is NOT contradiction — if no source addresses the claim, return UNVERIFIED, never FALSE. FALSE only when a source EXPLICITLY contradicts the claim with specific facts. A speaker\'s first-person account of their own experience, uncontradicted, is UNVERIFIED.' },
    {
      role: 'user',
      content: `Verify this claim or statement:

"${text}"

Evidence (X Community Notes are highest trust):
${evidence || 'No direct evidence found.'}

Verdict?`,
    },
  ], settings)

  let verdict: Verdict = 'UNVERIFIED'
  let summary = 'Could not find sufficient evidence.'
  let confidence = 'low'
  try {
    const v = JSON.parse(verdictRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
    verdict    = v.verdict    ?? 'UNVERIFIED'
    summary    = v.summary    ?? summary
    confidence = v.confidence ?? 'low'
  } catch { /* keep defaults */ }

  return NextResponse.json({
    verdict,
    summary,
    confidence,
    communityNotes,
    xPosts,
    sources: geminiResults.map(r => ({ url: r.url, title: r.title, quote: r.markdown })),
  })
}
