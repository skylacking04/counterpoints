import { NextRequest, NextResponse } from 'next/server'
import { callLLM } from '@/lib/llm'
import type { Claim, LLMSettings, TopicCategory } from '@/types'

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const CATEGORIES: TopicCategory[] = [
  'political', 'business', 'finance', 'tech', 'science', 'health', 'history',
  'sports', 'entertainment', 'travel', 'food', 'environment', 'world', 'general',
]

// Cheap keyword fallback when the LLM omits/garbles the category. Never assumes politics —
// an unmatched topic resolves to 'general' (the safe catch-all).
function classifyCategory(topic: string, text: string): TopicCategory {
  const s = `${topic} ${text}`.toLowerCase()
  const has = (re: RegExp) => re.test(s)
  if (has(/politi|govern|elect|congress|senate|president|\bpolicy\b|democrat|republican|legislat|immigration|\btax\b|war\b|military|foreign policy/)) return 'political'
  if (has(/startup|acquisi|merger|ipo|venture|funding round|\bceo\b|\bvaluation\b|company|business|\bbrand\b/)) return 'business'
  if (has(/stock|market|invest|\bbond\b|interest rate|inflation|\bgdp\b|earnings|crypto|finance|fed\b|nasdaq|portfolio/)) return 'finance'
  if (has(/\bai\b|software|app\b|chip|semiconductor|algorithm|\bcode\b|gadget|smartphone|cyber|tech\b|platform|silicon valley/)) return 'tech'
  if (has(/physics|chemis|biolog|astronom|space\b|nasa|research study|experiment|quantum|genom|particle|climate science/)) return 'science'
  if (has(/health|disease|vaccine|virus|medic|hospital|drug\b|fda|cdc|\bcovid\b|cancer|nutrition|mental health/)) return 'health'
  if (has(/histor|ancient|\bwar of\b|century|empire|dynasty|\b19\d\d\b|\b18\d\d\b|medieval/)) return 'history'
  if (has(/\bnfl\b|\bnba\b|\bmlb\b|soccer|football|basketball|baseball|olympic|championship|athlete|\bteam\b.*\bgame\b/)) return 'sports'
  if (has(/movie|film\b|\bactor\b|music|album|celebrity|hollywood|tv show|streaming|box office|grammy|oscar/)) return 'entertainment'
  if (has(/travel|tourist|flight|airline|hotel|destination|vacation|passport|cruise/)) return 'travel'
  if (has(/recipe|cuisine|restaurant|\bchef\b|\bfood\b|cooking|ingredient|\bdiet\b/)) return 'food'
  if (has(/climate|environment|emission|carbon|pollution|wildlife|ecosystem|renewable|biodiversity/)) return 'environment'
  if (has(/\bun\b|nato|treaty|\bborder\b|geopolit|international|global|foreign|nation|country/)) return 'world'
  return 'general'
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

Do NOT flag: opinions ("I think it's great"), feelings, jokes, questions, greetings, vague chit-chat, anything already in the "already fact-checked" list, OR minor/trivial/self-evident statements a viewer wouldn't care to verify.

BE SELECTIVE. Prioritize the MOST significant, consequential claims — the ones a skeptical viewer would actually want checked (surprising stats, bold assertions, disputed facts). Skip atomized fragments and obvious throwaway lines even if technically checkable. Return **at most 4** claims, the most important ones. Fewer, high-quality claims beat many trivial ones.

Return JSON ONLY (no markdown fences). Array, empty if nothing checkable:
[{
  "text": "the claim with ALL pronouns/vague references resolved from context — replace 'he/she/they/this guy/it/that' with the actual name, country, policy, or subject. Never leave an unresolved referent.",
  "topic": "brief topic label (2-4 words)",
  "category": "one of: political, business, finance, tech, science, health, history, sports, entertainment, travel, food, environment, world, general — pick the best fit; use 'general' if unsure. Do NOT default to political.",
  "confidence": 0.0-1.0
}]

Include only statements with confidence >= 0.6.`

  try {
    const raw = await callLLM([
      { role: 'system', content: 'You are a precise JSON-only fact-check gatekeeper. You decide which statements warrant verification.' },
      { role: 'user', content: prompt },
    ], settings)

    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean) as Array<{ text: string; topic: string; category?: string; confidence: number }>

    // Enforce selectivity: confidence floor + keep only the strongest few per scan, so the feed
    // isn't flooded with trivial atomized claims.
    const claims: Claim[] = parsed
      .filter(c => c.text?.trim() && (c.confidence ?? 0) >= 0.6)
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, 4)
      .map(c => {
        // Trust the LLM's category only if it's in the allow-list; otherwise classify by keyword.
        const category = CATEGORIES.includes(c.category as TopicCategory)
          ? (c.category as TopicCategory)
          : classifyCategory(c.topic ?? '', c.text)
        return {
          id: uuid(),
          text: c.text,
          topic: c.topic,
          category,
          confidence: c.confidence,
          transcriptOffsetMs,
        }
      })

    return NextResponse.json({ claims })
  } catch (err) {
    console.error('analyze error', err)
    return NextResponse.json({ claims: [] })
  }
}
