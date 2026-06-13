import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { provider, apiKey } = await req.json() as { provider: string; apiKey: string }

  if (!apiKey?.trim()) {
    return NextResponse.json({ ok: false, error: 'No key provided' })
  }

  try {
    switch (provider) {
      case 'gemini': {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=1`,
          { signal: AbortSignal.timeout(6000) }
        )
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: { message: string } }
          return NextResponse.json({ ok: false, error: err.error?.message ?? `HTTP ${res.status}` })
        }
        return NextResponse.json({ ok: true, message: 'Gemini connected' })
      }

      case 'claude': {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok && res.status !== 400) {
          const err = await res.json().catch(() => ({})) as { error?: { message: string } }
          return NextResponse.json({ ok: false, error: err.error?.message ?? `HTTP ${res.status}` })
        }
        return NextResponse.json({ ok: true, message: 'Claude connected' })
      }

      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/models?limit=1', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(6000),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: { message: string } }
          return NextResponse.json({ ok: false, error: err.error?.message ?? `HTTP ${res.status}` })
        }
        return NextResponse.json({ ok: true, message: 'OpenAI connected' })
      }

      case 'grok': {
        const res = await fetch('https://api.x.ai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(6000),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: { message: string } }
          return NextResponse.json({ ok: false, error: err.error?.message ?? `HTTP ${res.status}` })
        }
        return NextResponse.json({ ok: true, message: 'xAI Grok connected' })
      }

      case 'groq': {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(6000),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: { message: string } }
          return NextResponse.json({ ok: false, error: err.error?.message ?? `HTTP ${res.status}` })
        }
        return NextResponse.json({ ok: true, message: 'Groq connected' })
      }

      default:
        return NextResponse.json({ ok: false, error: 'Unknown provider' })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg.includes('timeout') ? 'Connection timed out' : msg })
  }
}
