// Gemini text-embedding-004 via Vertex AI: 768-dim semantic similarity embeddings
// Used for claim deduplication + KB lookup.

// Process-level cache — warm Cloud Run instances reuse embeddings across requests
const embeddingCache = new Map<string, number[]>()
const CACHE_MAX = 1000

const TIME_SENSITIVE = /\b(today|yesterday|this week|this month|this year|last week|last month|recently|just now|breaking|latest|2024|2025|2026|announced|said today|told reporters|in a statement|election|vote|ballot|congress|senate|president|prime minister|white house|supreme court|bill|passed|signed|executive order|tariff)\b/i

export function isTimeSensitive(text: string): boolean {
  return TIME_SENSITIVE.test(text)
}

export async function getEmbedding(text: string): Promise<number[]> {
  const key = text.slice(0, 200).toLowerCase()
  if (embeddingCache.has(key)) return embeddingCache.get(key)!

  try {
    const { ai } = await import('./genai')
    const res = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: [{ parts: [{ text: text.slice(0, 2048) }] }],
    })
    const vec = res.embeddings?.[0]?.values ?? []

    // Evict oldest entries when cache is full
    if (embeddingCache.size >= CACHE_MAX) {
      const first = embeddingCache.keys().next().value
      if (first) embeddingCache.delete(first)
    }
    embeddingCache.set(key, vec)
    return vec
  } catch (e) {
    console.error('[embeddings] fetch failed:', e)
    return []
  }
}

export function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// Normalize topic to a bucket key (reduces fragmentation)
export function topicBucket(topic: string): string {
  const t = topic.toLowerCase().trim()
  if (/politi|govern|elect|congress|senate|president|law|policy|democrat|republican|war|military|foreign|immigration|tax|budget/.test(t)) return 'politics'
  if (/tech|ai|software|hardware|crypto|blockchain|startup|silicon/.test(t)) return 'tech'
  if (/science|physics|biology|chemistry|space|nasa|climate|environment|health|medical|vaccine/.test(t)) return 'science'
  if (/econom|market|stock|finance|gdp|inflation|trade|business|company|ceo/.test(t)) return 'economy'
  if (/sport|football|basketball|baseball|soccer|nba|nfl|mlb|olympic/.test(t)) return 'sports'
  if (/histor|ancient|war world|century|decade/.test(t)) return 'history'
  return 'general'
}
