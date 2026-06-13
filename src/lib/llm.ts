import type { LLMSettings } from '@/types'
import { ai, devAi } from './genai'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function callLLM(messages: Message[], settings?: LLMSettings): Promise<string> {
  const provider = settings?.provider ?? 'gemini'

  if (provider === 'gemini') return callGemini(messages)
  if (provider === 'claude') return callClaude(messages, settings?.apiKey ?? '')
  if (provider === 'openai') return callOpenAI(messages, settings?.apiKey ?? '')
  if (provider === 'grok')   return callGrok(messages, settings?.apiKey ?? '')

  return callGemini(messages)
}

async function callGemini(messages: Message[]): Promise<string> {
  const system = messages.find(m => m.role === 'system')?.content ?? ''
  const nonSystem = messages.filter(m => m.role !== 'system')

  // Prepend system prompt to first user message (avoids systemInstruction API format issues)
  const contents = nonSystem.map((m, i) => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: i === 0 && system ? `${system}\n\n${m.content}` : m.content }],
  }))

  try {
    const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents })
    return result.text ?? ''
  } catch (e) {
    // Vertex quota exhausted (429) etc. → fall back to the Developer API's separate quota.
    if (devAi) {
      try {
        const result = await devAi.models.generateContent({ model: 'gemini-2.5-flash', contents })
        return result.text ?? ''
      } catch { /* fall through to throw original */ }
    }
    throw e
  }
}

async function callClaude(messages: Message[], apiKey: string): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const system = messages.find(m => m.role === 'system')?.content
  const filtered = messages.filter(m => m.role !== 'system') as Array<{ role: 'user' | 'assistant'; content: string }>
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system,
    messages: filtered,
  })
  return res.content[0].type === 'text' ? res.content[0].text : ''
}

async function callOpenAI(messages: Message[], apiKey: string): Promise<string> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const res = await client.chat.completions.create({
    model: 'gpt-4o',
    messages,
    max_tokens: 2048,
  })
  return res.choices[0].message.content ?? ''
}

async function callGrok(messages: Message[], apiKey: string): Promise<string> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey, baseURL: 'https://api.x.ai/v1' })
  const res = await client.chat.completions.create({
    model: 'grok-3',
    messages,
    max_tokens: 2048,
  })
  return res.choices[0].message.content ?? ''
}
