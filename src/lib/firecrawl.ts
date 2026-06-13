import { searchWithGemini } from './gemini-search'

export interface ArticleResult {
  url: string
  title: string
  markdown: string
  author?: string
  publishedDate?: string
  description?: string
}

// Jina Reader — scrapes a single URL to clean markdown, free
async function jinaRead(url: string): Promise<string> {
  const apiKey = process.env.JINA_API_KEY
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
    })
    if (!res.ok) return ''
    return (await res.text()).slice(0, 3000)
  } catch {
    return ''
  }
}

// Jina Search — fallback if Gemini search fails
async function jinaSearch(query: string, limit = 5): Promise<ArticleResult[]> {
  const apiKey = process.env.JINA_API_KEY
  const encoded = encodeURIComponent(query)
  try {
    const res = await fetch(`https://s.jina.ai/${encoded}`, {
      headers: {
        'Accept': 'application/json',
        'X-Respond-With': 'no-content',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
    })
    if (!res.ok) throw new Error(`Jina search ${res.status}`)
    const data = await res.json() as { data?: JinaItem[] }
    return (data.data ?? []).slice(0, limit).map(r => ({
      url:         r.url,
      title:       r.title ?? r.url,
      markdown:    (r.content ?? r.description ?? '').slice(0, 3000),
      publishedDate: r.publishedDate,
    }))
  } catch {
    return []
  }
}

interface JinaItem {
  url: string; title?: string; content?: string; description?: string; publishedDate?: string
}

export async function searchArticles(
  query: string,
  domains?: string[],
  limit = 5,
  lens = 'center',
): Promise<ArticleResult[]> {
  // Primary: Tavily with domain restriction — fast (~1-2s) and the key now has credits.
  const tavDomain = await tavilyFallback(query, domains, limit)
  if (tavDomain.length > 0) { console.log(`[searchArticles] ${lens}: tavily-domain=${tavDomain.length}`); return tavDomain }

  // Fallback 1: Gemini Google Search grounding (slower ~5-8s, but reads real pages)
  const geminiResults = await searchWithGemini(query, lens, domains ?? [], limit)
  if (geminiResults.length > 0) { console.log(`[searchArticles] ${lens}: gemini=${geminiResults.length}`); return geminiResults }

  // Fallback 2: Jina Search (domain-restricted, then broad)
  const domainFilter = domains?.length
    ? ' (' + domains.map(d => `site:${d}`).join(' OR ') + ')'
    : ''
  let jinaResults = await jinaSearch(query + domainFilter, limit)
  if (jinaResults.length === 0 && domainFilter) jinaResults = await jinaSearch(query, limit)
  if (jinaResults.length > 0) { console.log(`[searchArticles] ${lens}: jina=${jinaResults.length}`); return jinaResults }

  // Fallback 3: Tavily without domain restriction (broadest)
  const broad = await tavilyFallback(query, undefined, limit)
  console.log(`[searchArticles] ${lens}: tavily-broad=${broad.length}${broad.length === 0 ? ' (ALL-EMPTY)' : ''}`)
  return broad
}

export async function fetchArticleText(url: string): Promise<string> {
  return jinaRead(url)
}

// Remember keys that recently returned 432 (out of credits) so the 5 parallel lenses don't
// each waste ~4s re-trying a dead key. Cleared after a cooldown in case credits refill.
const exhaustedTavily = new Map<string, number>()
const TAVILY_COOLDOWN_MS = 5 * 60_000

// Configured Tavily keys, skipping any recently seen as exhausted.
function tavilyKeys(): string[] {
  const now = Date.now()
  return [
    process.env.TAVILY_API_KEY,
    process.env.TAVILY_API_KEY_2,
    process.env.TAVILY_API_KEY_3,
  ].filter((k): k is string => !!k)
    .filter(k => (exhaustedTavily.get(k) ?? 0) < now)
}

async function tavilyFallback(
  query: string,
  domains?: string[],
  limit = 5,
): Promise<ArticleResult[]> {
  const keys = tavilyKeys()
  for (const apiKey of keys) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'basic',
          max_results: limit,
          include_domains: domains ?? [],
        }),
      })
      if (res.status === 429 || res.status === 432 || res.status === 403) {
        exhaustedTavily.set(apiKey, Date.now() + TAVILY_COOLDOWN_MS)  // skip this key for a while
        console.warn(`[tavily] key exhausted (${res.status}), rotating`)
        continue
      }
      const data = await res.json() as { results?: Record<string, unknown>[] }
      const results = (data.results ?? []).map(r => ({
        url:           r.url as string,
        title:         r.title as string,
        markdown:      r.content as string,
        publishedDate: r.published_date as string | undefined,
      }))
      if (results.length > 0) return results
    } catch {
      continue
    }
  }
  return []
}

export async function getJournalistHistory(
  authorName: string,
  domain: string,
  limit = 3,
): Promise<ArticleResult[]> {
  return searchArticles(`"${authorName}" ${domain}`, [domain], limit)
}
