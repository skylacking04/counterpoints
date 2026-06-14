export interface GrokNote {
  text: string
  url: string
  upvotes?: number
}

export interface GrokPost {
  author: string
  text: string
  url: string
  videoUrl?: string
}

export interface GrokResult {
  notes: GrokNote[]
  posts: GrokPost[]
}

// X.com / scrapers serve anti-bot, search-placeholder, or junk pages instead of real post
// content. Drop those so the Community panel never shows nonsense.
const GARBAGE_PATTERNS = [
  'javascript is not available',
  "we've detected that javascript is disabled",
  'enable javascript',
  'supported browsers in our help center',
  'log in to x',
  'sign up for twitter',
  "this account doesn't exist",
  'this account doesn’t exist',
  'something went wrong',
  'rate limit exceeded',
  // X / search-engine placeholder snippets (not real posts)
  'find the latest posts',
  'latest posts, discussions, and updates',
  'discussions, and updates about',
  'see the latest conversations',
  'posts on x about',
  'search results for',
]
function isGarbageText(text: string): boolean {
  const t = (text || '').toLowerCase()
  if (t.trim().length < 20) return true
  return GARBAGE_PATTERNS.some(p => t.includes(p))
}

// Keep only posts that actually relate to the claim. Niche/first-person claims often share just
// one strong proper-noun entity with the matching post, so require ≥2 generic overlaps OR ≥1
// distinctive (6+ char) entity overlap — otherwise relevant posts get filtered to an empty lens.
function relevantTo(claim: string) {
  const claimWords = new Set((claim.toLowerCase().match(/[a-z]{4,}/g) ?? []))
  const claimEntities = new Set((claim.toLowerCase().match(/[a-z]{6,}/g) ?? []))
  return (text: string): boolean => {
    const words = text.toLowerCase().match(/[a-z]{4,}/g) ?? []
    let overlap = 0
    for (const w of words) {
      if (claimEntities.has(w)) return true          // one distinctive entity match is enough
      if (claimWords.has(w)) { overlap++; if (overlap >= 2) return true }
    }
    return false
  }
}

function cleanPosts(posts: GrokPost[], claim?: string): GrokPost[] {
  const rel = claim ? relevantTo(claim) : () => true
  return posts.filter(p => !isGarbageText(p.text) && rel(p.text))
}

// Strip stale garbage/irrelevant/non-X items from a cached claim's grok lens at serve time.
// The X Community lens must only contain real x.com / twitter.com links.
export function cleanGrokSpectrum<T extends { quote: string; url?: string }>(items: T[], claim: string): T[] {
  const rel = relevantTo(claim)
  const isX = (url?: string) => !!url && /(?:[a-z0-9-]+\.)?(?:x\.com|twitter\.com)\//i.test(url)
  return (items ?? []).filter(i => isX(i.url) && !isGarbageText(i.quote) && rel(i.quote))
}
function cleanNotes(notes: GrokNote[], claim?: string): GrokNote[] {
  const rel = claim ? relevantTo(claim) : () => true
  return notes.filter(n => !isGarbageText(n.text) && rel(n.text))
}

async function searchViaJina(claim: string): Promise<GrokResult> {
  const key = process.env.JINA_API_KEY
  if (!key) return { notes: [], posts: [] }
  try {
    const encoded = encodeURIComponent(`${claim.slice(0, 120)} fact check twitter discussion`)
    const res = await fetch(`https://s.jina.ai/${encoded}`, {
      headers: {
        'Accept': 'application/json',
        'X-Respond-With': 'no-content',
        'Authorization': `Bearer ${key}`,
      },
    })
    if (!res.ok) return { notes: [], posts: [] }
    const data = await res.json() as { data?: { url: string; title?: string; content?: string }[] }
    return {
      notes: [],
      posts: cleanPosts((data.data ?? []).slice(0, 8).map(r => {
        let author = 'Source'
        try { author = new URL(r.url).hostname.replace('www.', '') } catch { /* ignore */ }
        return { author, text: (r.content ?? r.title ?? '').slice(0, 280), url: r.url }
      }), claim),
    }
  } catch {
    return { notes: [], posts: [] }
  }
}

// Returns all configured Tavily keys in order (primary → key2 → key3)
function getTavilyKeys(): string[] {
  return [
    process.env.TAVILY_API_KEY,
    process.env.TAVILY_API_KEY_2,
    process.env.TAVILY_API_KEY_3,
  ].filter((k): k is string => !!k)
}

async function searchXViaTavily(claim: string): Promise<GrokResult> {
  // Primary: Jina (free, no quota concerns)
  const jinaResult = await searchViaJina(claim)
  if (jinaResult.posts.length > 0) return jinaResult

  // Fallback: Tavily with key rotation (try each key until one works)
  const keys = getTavilyKeys()
  if (keys.length === 0) return { notes: [], posts: [] }

  for (const key of keys) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: key,
          query: claim.slice(0, 150),
          include_domains: ['x.com', 'twitter.com'],
          max_results: 5,
        }),
      })
      if (res.status === 429 || res.status === 403) {
        console.warn(`[tavily] key exhausted (${res.status}), trying next key`)
        continue
      }
      const data = await res.json()
      if (!data.results) continue
      const posts = cleanPosts((data.results as { url: string; title: string; content: string }[]).map(r => {
        let author = 'X User'
        try { author = new URL(r.url).pathname.split('/')[1] ?? 'X User' } catch { /* ignore */ }
        return { author, text: (r.content ?? r.title ?? '').slice(0, 280), url: r.url }
      }), claim)
      if (posts.length > 0) return { notes: [], posts }
    } catch {
      continue
    }
  }
  return { notes: [], posts: [] }
}

export async function searchGrokNotes(claim: string): Promise<GrokResult> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) return searchXViaTavily(claim)   // fallback when XAI key not configured

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          {
            role: 'user',
            content: `On X/Twitter, find content about this claim: "${claim}"

PRIORITIZE official **Community Notes** that have been rated "Helpful" and are publicly showing on a post — these are the gold standard (crowd-verified corrections). Then, only if needed, credible posts from knowledgeable accounts.

Return JSON only (no markdown). Every "url" MUST be a real x.com or twitter.com post/status URL — never a news article, YouTube, or other site. If you can't find a real X link, omit that item.
{
  "notes": [{ "text": "the Community Note text", "url": "https://x.com/.../status/...", "upvotes": 0 }],
  "posts": [{ "author": "handle", "text": "...", "url": "https://x.com/.../status/..." }]
}
Up to 3 Community Notes and 2 posts. Prefer fewer, real notes over filler. If none found, return empty arrays.`,
          },
        ],
        max_tokens: 1024,
      }),
    })

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? '{}'
    const clean = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean)
    const result: GrokResult = {
      notes: cleanNotes(Array.isArray(parsed?.notes) ? parsed.notes : [], claim),
      posts: cleanPosts(Array.isArray(parsed?.posts) ? parsed.posts : [], claim),
    }
    // If grok returned nothing usable, fall back to Tavily X search
    if (result.notes.length === 0 && result.posts.length === 0) {
      return searchXViaTavily(claim)
    }
    return result
  } catch {
    return searchXViaTavily(claim)
  }
}
