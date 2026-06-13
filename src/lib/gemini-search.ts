import { ai, devAi } from './genai'
import type { ArticleResult } from './firecrawl'

interface GroundingChunk {
  web?: { uri?: string; title?: string }
}

export async function searchWithGemini(
  query: string,
  lens: string,
  domains: string[],
  limit = 2,
): Promise<ArticleResult[]> {
  try {
    const domainHint = domains.slice(0, 4).join(', ')
    const prompt = `You are a research assistant. Search for how ${lens}-leaning sources cover this claim.
Preferred sources: ${domainHint}

Claim: "${query}"

Return ONLY a JSON array (no markdown fences):
[{"url":"exact_url","title":"article title","quote":"one sentence summary of what this source says about the claim","publishedDate":"YYYY-MM-DD or null"}]

Include up to ${limit} results. Use sources actually returned by your search.`

    const genReq = {
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { tools: [{ googleSearch: {} }] },
    }
    // Primary: Gemini Developer API grounding (fresh, mostly-idle quota). This keeps the
    // heavily-rate-limited Vertex quota free for the verdict/quote LLM calls. Vertex is the
    // fallback if the Developer key isn't configured or its call fails.
    let result
    try {
      result = await (devAi ?? ai).models.generateContent(genReq)
    } catch (e) {
      if (devAi) { result = await ai.models.generateContent(genReq) }
      else throw e
    }

    const response = result
    const text = result.text ?? ''

    // Extract grounding chunks (real source URLs from Google Search)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (response as any)?.candidates?.[0]?.groundingMetadata
    const groundingUrls: Array<{ url: string; title: string }> = ((meta?.groundingChunks ?? []) as GroundingChunk[])
      .filter(c => c.web?.uri)
      .map(c => ({ url: c.web!.uri!, title: c.web!.title ?? '' }))

    // Parse LLM JSON response (best-effort — grounding chunks are the source of truth)
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonMatch = clean.match(/\[[\s\S]*\]/)

    let parsed: Array<{ url: string; title: string; quote: string; publishedDate?: string }> = []
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]) } catch { /* ignore parse error */ }
    }

    // If Gemini returned grounding chunks but no valid JSON, synthesize from chunks
    if (parsed.length === 0 && groundingUrls.length > 0) {
      return groundingUrls.slice(0, limit).map(g => ({
        url:           g.url,
        title:         g.title,
        markdown:      text.slice(0, 300),
        publishedDate: undefined,
      })).filter(r => r.url.startsWith('http'))
    }

    return parsed.slice(0, limit).map((item, i) => ({
      url:           groundingUrls[i]?.url  ?? item.url,
      title:         groundingUrls[i]?.title ?? item.title,
      markdown:      item.quote,
      publishedDate: item.publishedDate ?? undefined,
    })).filter(r => r.url && r.url.startsWith('http'))

  } catch (err) {
    console.error('[gemini-search] failed:', err)
    return []
  }
}
