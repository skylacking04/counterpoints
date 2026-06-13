import { NextRequest, NextResponse } from 'next/server'
import { callLLM } from '@/lib/llm'
import type { Claim, LLMSettings } from '@/types'

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function POST(req: NextRequest) {
  const { transcript, settings, transcriptOffsetMs = 0, recentClaims = [], contextSummary = '' } = await req.json() as {
    transcript: string
    settings?: LLMSettings
    transcriptOffsetMs?: number
    recentClaims?: string[]   // already-checked claims (memory) — do not re-flag
    contextSummary?: string   // short running summary of the conversation so far
  }

  if (!transcript?.trim()) return NextResponse.json({ claims: [] })
  // Cap transcript length to prevent runaway LLM costs
  const cappedTranscript = transcript.slice(0, 8000)
  const memoryBlock = recentClaims.length
    ? `\nAlready fact-checked (DO NOT repeat these or trivial rephrasings):\n${recentClaims.slice(-20).map(c => `- ${c}`).join('\n')}\n`
    : ''
  const contextBlock = contextSummary ? `\nConversation so far (for resolving references): ${contextSummary}\n` : ''

  const prompt = `You are the GATEKEEPER of a real-time fact-checking system for ANY spoken content — news, podcasts, interviews, tech talks, debates. Go sentence by sentence through the NEW transcript below and decide for each: "Is this a verifiable factual claim that SHOULD be fact-checked?" Output every statement that should be checked. Be thorough — it is better to flag a borderline checkable claim than to miss one — but never flag pure opinion, banter, or questions.
${contextBlock}${memoryBlock}
NEW transcript to review:
"""
${cappedTranscript}
"""

A statement SHOULD be checked if it asserts something that could be true or false and looked up:
- Statistics / numbers / amounts / dates ("unemployment is 3.4%", "launched in 2019", "$149")
- Named-entity assertions ("X did Y", "Company Z acquired W")
- Claims about people/policy/law/government/elections
- Causal claims ("X caused Y", "because of Z")
- Comparatives / superlatives ("more than ever", "the first", "the biggest", "10x faster")
- Predictions stated as fact ("this will collapse the economy")
- Attributions / quotes ("X said Y", "according to Z")
- Historical, scientific, health, business, or product claims

Do NOT flag: opinions ("I think it's great"), feelings, jokes, questions, greetings, vague chit-chat, or anything already in the "already fact-checked" list above.

Return JSON ONLY (no markdown fences). Array, empty if nothing checkable:
[{
  "text": "the claim with ALL pronouns/vague references resolved from context — replace 'he/she/they/this guy/it/that' with the actual name, country, policy, or subject. Never leave an unresolved referent.",
  "topic": "brief topic label (2-4 words)",
  "confidence": 0.0-1.0
}]

Include statements with confidence >= 0.5.`

  try {
    const raw = await callLLM([
      { role: 'system', content: 'You are a precise JSON-only fact-check gatekeeper. You decide which statements warrant verification.' },
      { role: 'user', content: prompt },
    ], settings)

    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean) as Array<{ text: string; topic: string; confidence: number }>

    const claims: Claim[] = parsed.map(c => ({
      id: uuid(),
      text: c.text,
      topic: c.topic,
      confidence: c.confidence,
      transcriptOffsetMs,
    }))

    return NextResponse.json({ claims })
  } catch (err) {
    console.error('analyze error', err)
    return NextResponse.json({ claims: [] })
  }
}
