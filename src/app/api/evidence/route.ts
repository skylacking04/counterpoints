import { NextRequest, NextResponse } from 'next/server'
import { callLLM } from '@/lib/llm'
import { searchArticles } from '@/lib/firecrawl'
import { searchGrokNotes, cleanGrokSpectrum } from '@/lib/grok-notes'
import { searchTrustedChannels } from '@/lib/youtube-search'
import { getSourceProfile, SPECTRUM_DOMAINS, POLITICAL_DOMAINS, lensDomains, hasPartisanFraming } from '@/lib/source-db'
import { CHANNELS_BY_TOPIC } from '@/lib/trusted-channels'
import { findCachedClaim, storeClaim, trackSourceUse, getLearnedDomains } from '@/lib/knowledge-base'
import { topicBucket, isTimeSensitive } from '@/lib/embeddings'
import type { CounterpointCard, LLMSettings, SpectrumItem, SpectrumLens, TopicCategory, Verdict } from '@/types'

// Build the search query from the claim. The analyze route already resolved pronouns into
// real entities, so the claim itself is the strongest query — appending the loose topic label
// added noise that surfaced generic articles (the Weblogs→generic-Yahoo-acquisitions failure).
function searchQuery(claim: string): string {
  return claim.trim().slice(0, 200)
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Agent final-step gate: ONE batched LLM call validates that each X post is on-topic for the
// claim AND contains a substantive factual statement (not bios, ads, search placeholders, or
// vague chatter). Degrades gracefully — on any failure it keeps the posts as-is.
async function validateXPosts(items: SpectrumItem[], claim: string, settings?: LLMSettings): Promise<SpectrumItem[]> {
  if (items.length === 0) return items
  try {
    const numbered = items.map((it, i) => `[${i}] ${it.source}: ${it.quote}`).join('\n')
    const raw = await callLLM([
      {
        role: 'system',
        content: 'You filter social posts for a fact-check. Respond with JSON only: { "keep": [indices] }. Keep ONLY posts that are BOTH (a) clearly about the same topic as the claim AND (b) contain a substantive factual statement, correction, or community note — not bios, ads, promos, search-page placeholders, or vague chatter. If unsure, drop it.',
      },
      { role: 'user', content: `Claim: "${claim}"\n\nPosts:\n${numbered}\n\nWhich indices should be kept?` },
    ], settings)
    const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
    if (!Array.isArray(parsed?.keep)) return items
    const keep = new Set<number>(parsed.keep.map((n: unknown) => Number(n)))
    const filtered = items.filter((_, i) => keep.has(i))
    return filtered.length > 0 ? filtered : []
  } catch {
    return items  // never break the pipeline on a validation hiccup
  }
}

// A URL that's actually an X/Twitter post (not a random web article the fallback dragged in).
function isXPostUrl(url: string): boolean {
  return /(?:^https?:\/\/)?(?:[a-z0-9-]+\.)?(?:x\.com|twitter\.com)\/[^/]+\/status/i.test(url)
    || /(?:^https?:\/\/)?(?:[a-z0-9-]+\.)?(?:x\.com|twitter\.com)\//i.test(url)
}

// Whole X/Community lens: gather notes+posts, keep ONLY real x.com/twitter.com links (the web-search
// fallback returns non-X articles that don't belong here), then run the relevance/factual gate.
async function buildGrokLens(claim: string, settings?: LLMSettings): Promise<SpectrumItem[]> {
  const grokResult = await searchGrokNotes(claim)
  const raw: SpectrumItem[] = [
    ...(grokResult?.notes ?? []).map(n => ({ source: 'X Community Note', url: n.url, quote: n.text })),
    ...(grokResult?.posts ?? []).map(p => ({ source: `@${p.author}`, url: p.url, quote: p.text })),
  ].filter(i => isXPostUrl(i.url))
  return validateXPosts(raw, claim, settings)
}

async function buildSpectrumItems(
  lens: SpectrumLens,
  claim: string,
  topic: string,
  category: TopicCategory,
  settings?: LLMSettings,
  learnedDomains?: string[]
): Promise<SpectrumItem[]> {
  if (lens === 'grok') return []

  // Per-category domain pool for this lens (establishment, category-aware center, etc.).
  const staticDomains = lensDomains(category, lens)
  if (staticDomains.length === 0) return []  // lens not applicable to this category (e.g. left/right on a travel claim)

  // Learned best domains only apply to partisan topics — they're learned from political source
  // use and would pollute science/business/etc. pools.
  const merged = learnedDomains?.length && hasPartisanFraming(category)
    ? [...new Set([...learnedDomains.slice(0, 4), ...staticDomains])]
    : staticDomains
  const query = searchQuery(claim)
  // Establishment lens = the institutional consensus → use REAL Google grounding first so it
  // reliably surfaces Wikipedia / official fact-checkers instead of whatever Tavily happens to hit.
  const preferGrounding = lens === 'establishment'
  // Fetch 3 (not 2) so the per-article relevance filter below can drop an off-topic hit and still
  // leave ~2 real sources for this lens.
  let articles = await searchArticles(query, merged, 3, lens, { preferGrounding })
  // Loosen if the domain-restricted search found nothing — drop the domain filter to surface
  // the closest available source for this lens rather than showing a blank column.
  if (articles.length === 0) {
    articles = await searchArticles(query, [], 3, lens, { preferGrounding })
  }

  // One LLM call per article: judge RELEVANCE + extract a quote in the same pass. Drop sources that
  // don't actually address the claim — search engines return off-topic articles (the "CNN story about
  // a homeless youth in Uganda for a Yahoo claim" failure), and showing them made verdicts look wrong.
  // An empty lens after filtering is fine — the card always shows all six tabs with a "no sources" state.
  const judged = await Promise.all(
    articles.slice(0, 3).map(async (art): Promise<SpectrumItem | null> => {
      const profile = getSourceProfile(art.url)
      let quote = ''
      let relevant = true  // on LLM/parse failure, keep the source (graceful — failures are rare)
      try {
        const raw = await callLLM([
          { role: 'system', content: 'You judge whether a source actually addresses a specific claim. Respond JSON only: { "relevant": true|false, "quote": "one specific sentence on what it says about the claim (cite a key fact/figure), or empty" }. Set relevant=false if the article is about a different topic, person, or event and does not address the claim.' },
          { role: 'user', content: `Claim: "${claim}"\nArticle excerpt: "${art.markdown.slice(0, 800)}"\nDoes this article actually address THIS claim?` },
        ], settings)
        const j = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
        relevant = j.relevant !== false
        quote = typeof j.quote === 'string' ? j.quote.trim() : ''
      } catch { /* keep graceful */ }
      if (!relevant) return null  // off-topic → drop rather than show an irrelevant source
      if (!quote) quote = art.markdown.slice(0, 200).trim() || art.title || '(source found — summary unavailable)'

      return {
        source:        art.title || profile?.domain || art.url,
        url:           art.url,
        quote,
        publishedDate: art.publishedDate,
        bias:          profile?.bias,
        allSidesRating: profile?.allSidesRating,
        reliability:   profile?.reliability,
      } satisfies SpectrumItem
    })
  )
  return judged.filter((x): x is SpectrumItem => x !== null).slice(0, 2)
}

async function buildAltItems(
  claim: string,
  topic: string,
  category: TopicCategory,
  settings?: LLMSettings
): Promise<SpectrumItem[]> {
  const political = hasPartisanFraming(category)
  const altDomains = political ? POLITICAL_DOMAINS.alt : SPECTRUM_DOMAINS.alt

  // For political topics, search a broader channel set including TJDS, Kim Iversen, Valuetainment, Vigilant Fox
  const channelQuery = `${topic} ${claim.split(' ').slice(0, 6).join(' ')}`
  const channelTopicKey = political ? 'political' : 'general'

  const [articles, videos] = await Promise.all([
    searchArticles(searchQuery(claim), altDomains, 2, 'alt'),
    searchTrustedChannels(channelQuery, (CHANNELS_BY_TOPIC[channelTopicKey] ?? []).map(c => c.channelId).slice(0, 8)),
  ])

  const items: SpectrumItem[] = []

  for (const art of articles.slice(0, 1)) {
    const profile = getSourceProfile(art.url)
    let quote = ''
    try {
      quote = (await callLLM([
        { role: 'system', content: 'Respond with 1 sentence only.' },
        { role: 'user', content: `Claim: "${claim}"\nArticle: "${art.markdown.slice(0, 600)}"\nOne sentence: what does this say about the claim?` },
      ], settings)).trim()
    } catch { /* fall back below */ }
    if (!quote) quote = art.markdown.slice(0, 200).trim() || art.title || '(source found — summary unavailable)'
    items.push({
      source: art.title || art.url,
      url: art.url,
      quote,
      bias: profile?.bias ?? 'alt',
      reliability: profile?.reliability,
    })
  }

  for (const vid of videos.slice(0, 2)) {
    if (!vid.captionWindow) continue
    let quoteRaw = ''
    try {
      quoteRaw = await callLLM([
        { role: 'system', content: 'Respond with 1 sentence only.' },
        { role: 'user', content: `Claim: "${claim}"\nVideo caption: "${vid.captionWindow.slice(0, 600)}"\nOne sentence: what does this video say about the claim?` },
      ], settings)
    } catch { quoteRaw = vid.captionWindow.slice(0, 200) }
    items.push({
      source:             `${vid.channelName} video`,
      url:                vid.watchUrl,
      quote:              quoteRaw.trim(),
      videoId:            vid.videoId,
      videoTimestampSec:  vid.timestampSec ?? undefined,
      channelName:        vid.channelName,
      thumbnailUrl:       vid.thumbnailUrl,
    })
  }

  return items
}

// COUNTERPOINT ENGINE — the namesake feature. Turn the claim into the single most decisive
// opposing/contextualizing question, then answer it with a real figure from a grounded source.
// e.g. claim "the rich should pay more taxes" → "What share of income tax do the top 1% pay?" →
// "The top 1% pay ~40% of federal income tax (Tax Foundation)."
async function buildCounterpoint(
  claim: string,
  settings?: LLMSettings,
): Promise<CounterpointCard['counterpoint']> {
  try {
    const q = (await callLLM([
      { role: 'system', content: 'You surface the key opposing fact for a fact-check. Reply with ONE short factual question only — the single question whose answer most directly challenges, quantifies, or contextualizes the claim. No preamble, no quotes.' },
      { role: 'user', content: `Claim: "${claim}"\n\nGive the one factual question whose answer most directly challenges or contextualizes this claim. Example: claim "the rich should pay more in taxes" → "What share of US federal income taxes do the top 1% currently pay?"` },
    ], settings)).trim().replace(/^["']|["']$/g, '').slice(0, 200)
    if (!q) return undefined

    const arts = await searchArticles(q, [], 2, 'center', { preferGrounding: true })
    const top = arts[0]
    let fact = ''
    let sourceName: string | undefined
    let sourceUrl: string | undefined
    if (top) {
      sourceUrl = top.url
      sourceName = getSourceProfile(top.url)?.domain || top.title || undefined
      try {
        fact = (await callLLM([
          { role: 'system', content: 'Answer in ONE sentence with the specific figure or fact. No preamble.' },
          { role: 'user', content: `Question: "${q}"\nSource excerpt: "${top.markdown.slice(0, 800)}"\nAnswer the question with the key figure/fact from the excerpt.` },
        ], settings)).trim()
      } catch { /* fall through */ }
    }
    if (!fact) fact = `Needs lookup: ${q}`
    return { question: q, fact, sourceName, sourceUrl }
  } catch {
    return undefined
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { claim: string; topic: string; claimId: string; category?: TopicCategory; settings?: LLMSettings; noCache?: boolean }
  const claim   = String(body.claim  ?? '').slice(0, 500)
  const topic   = String(body.topic  ?? '').slice(0, 100)
  const claimId = String(body.claimId ?? '').slice(0, 64)
  const category: TopicCategory = body.category ?? 'general'   // open-ended topic class; never assume political
  const settings = body.settings
  const noCache  = body.noCache === true   // re-run sources: force a fresh search, skip the cache

  if (!claim.trim() || !claimId) {
    return NextResponse.json({ error: 'claim and claimId required' }, { status: 400 })
  }

  const bucket = topicBucket(topic)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const write = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      try {
        const [cached, learnedDomains] = await Promise.all([
          noCache ? Promise.resolve(null) : findCachedClaim(claim, topic),
          getLearnedDomains(bucket, 8),
        ])

        // Only trust the cache if it actually has article sources across the spectrum. Older
        // cached entries were stored before source-gathering worked and have empty L/C/R — for
        // those, fall through to a fresh search instead of serving blank sources.
        const cachedSp = cached?.spectrum
        const cachedArticleCount = cachedSp
          ? (cachedSp.left?.length ?? 0) + (cachedSp.center?.length ?? 0) + (cachedSp.right?.length ?? 0) + (cachedSp.alt?.length ?? 0)
          : 0

        // Never serve a cached FALSE from the knowledge base. FALSE verdicts stored before the
        // calibration (the "≥2 contradicting sources" guard + verify-pass downgrade) would bypass
        // it entirely — the Weblogs "deployed but still FALSE" trap. We don't persist
        // contradictingSources, so the only safe move is to re-check FALSE claims fresh, where the
        // current guard runs. FALSE is rare post-calibration, so this costs little.
        if (cached && cachedArticleCount > 0 && cached.verdict !== 'FALSE') {
          // Scrub stale garbage/irrelevant X posts that may have been cached previously.
          if (cached.spectrum?.grok) {
            cached.spectrum.grok = cleanGrokSpectrum(cached.spectrum.grok, claim)
          }
          const card: CounterpointCard = {
            id: claimId,
            claimId,
            claim,
            verdict:        cached.verdict,
            verdictSummary: `${cached.verdictSummary} *(from knowledge base — ${Math.round(cached.similarity * 100)}% match)*`,
            spectrum:       cached.spectrum,
            createdAt:      Date.now(),
            cacheHit:       true,
            cacheSimilarity: cached.similarity,
          }
          write({ type: 'done', card })
          controller.close()
          return
        }

        // Stream each lens as it resolves
        const spectrum: Record<string, SpectrumItem[]> = { left: [], center: [], right: [], alt: [], grok: [], establishment: [] }

        // Cap each lens so one slow web search can't gate the verdict. A lens that times out
        // returns whatever it had (usually []); the verdict proceeds with the rest. This keeps
        // time-to-verdict well under 15s. Slow lenses still stream in late (refinement).
        // Primary Tavily key now has credits (no 432 rotation waste). Keep a modest cap so a
        // single slow lens can't stall the verdict.
        const LENS_TIMEOUT_MS = 14_000
        const withTimeout = <T>(p: Promise<T>, fallback: T): Promise<T> =>
          Promise.race([p, new Promise<T>(r => setTimeout(() => r(fallback), LENS_TIMEOUT_MS))])

        // Each lens: stream when it resolves; on failure yield [] so it can never reject the
        // whole Promise.all (which would crash the stream and leave the card stuck on "Checking…").
        const runLens = (key: string, p: Promise<SpectrumItem[]>) =>
          withTimeout(p, [] as SpectrumItem[])
            .then(items => { spectrum[key] = items; write({ type: 'lens', key, items }) })
            .catch(() => { spectrum[key] = []; write({ type: 'lens', key, items: [] }) })

        // Every topic gets every perspective — there's always a left/right framing now, not just
        // for politics (taxes, tech, business all have sides). Establishment is ONE lens, not the
        // default. Left/Right use category-appropriate outlets (see lensDomains).
        const lensRuns = [
          runLens('establishment', buildSpectrumItems('establishment', claim, topic, category, settings)),
          runLens('center', buildSpectrumItems('center', claim, topic, category, settings, learnedDomains)),
          runLens('left',   buildSpectrumItems('left',  claim, topic, category, settings, learnedDomains)),
          runLens('right',  buildSpectrumItems('right', claim, topic, category, settings, learnedDomains)),
          runLens('alt',    buildAltItems(claim, topic, category, settings)),
          runLens('grok',   buildGrokLens(claim, settings)),
        ]
        await Promise.all(lensRuns)

        const allEvidence = [...spectrum.establishment, ...spectrum.center, ...spectrum.left, ...spectrum.right, ...spectrum.alt, ...spectrum.grok]
          .map(i => i.quote).join('\n')

        // Label evidence by perspective so the verdict engine can contrast how each side frames
        // the claim, then reconcile to the factual middle ground. The ESTABLISHMENT lens is the
        // institutional/consensus narrative — surfaced to contrast, NOT as automatic ground truth.
        const labeledEvidence = ([
          ['ESTABLISHMENT / institutional-consensus sources (Wikipedia, official fact-checkers, CDC/WHO)', spectrum.establishment],
          ['LEFT-leaning sources (e.g. MSNBC, The Hill left)', spectrum.left],
          ['RIGHT-leaning / conservative sources (e.g. Fox News)', spectrum.right],
          ['CENTER / wire-service & authoritative sources (e.g. Reuters, AP, journals, SEC)', spectrum.center],
          ['Independent / heterodox sources', spectrum.alt],
          ['X Community Notes & posts', spectrum.grok],
        ] as [string, SpectrumItem[]][])
          .filter(([, items]) => items.length > 0)
          .map(([label, items]) => `${label}:\n${items.map(i => `- ${i.source}: ${i.quote}`).join('\n')}`)
          .join('\n\n')

        // Total real source items gathered — used to enforce the "FALSE needs ≥2 contradicting
        // sources" rule in CODE (the model otherwise treats absence-of-evidence as a contradiction).
        const evidenceItemCount = spectrum.establishment.length + spectrum.center.length
          + spectrum.left.length + spectrum.right.length + spectrum.alt.length + spectrum.grok.length

        // Verdict + counterpoint run in parallel (counterpoint does its own search, independent of the verdict).
        const [verdictRaw, counterpoint] = await Promise.all([
          callLLM([
          {
            role: 'system',
            content: `You are a non-partisan fact-checker. Sources frame the same claim very differently across the political spectrum AND across the establishment/anti-establishment axis. Read every perspective, then determine the factual middle ground — what is actually verifiable, independent of spin.

Respond with JSON only: { "verdict": "TRUE"|"MISLEADING"|"FALSE"|"UNVERIFIED", "summary": "one sentence", "middleGround": "one sentence stating the actual facts", "contradictingSources": 0 }
- "contradictingSources": the NUMBER of distinct provided sources that EXPLICITLY state the claim is false. Count only real contradictions, not silence.

CALIBRATION RULES — follow strictly:
- ABSENCE IS NOT CONTRADICTION. If no provided source addresses the claim, return UNVERIFIED — never FALSE. "I couldn't find it" ≠ "it's false."
- A first-person account by the speaker about their own life/company/experience, with no source actively contradicting it, is UNVERIFIED (or note it's the speaker's own account) — NEVER FALSE.
- UNVERIFIED: Default when evidence is thin, absent, inconclusive, or the claim is breaking/live news. When in doubt, UNVERIFIED.
- TRUE: Only when 2+ independent reliable sources clearly corroborate the specific claim.
- MISLEADING: When the claim is technically inaccurate, exaggerated, or missing important context that the evidence supports.
- FALSE: Only when 2+ independent reliable sources EXPLICITLY contradict the claim with specific verifiable facts. ONE source is never enough; absence of corroboration is never enough.
- Hedged claims ("as many as", "up to", "approximately", "nearly"): treat small numeric discrepancies as UNVERIFIED, not FALSE.

ESTABLISHMENT AWARENESS:
- The ESTABLISHMENT lens (Wikipedia, official fact-checkers, CDC/WHO) is the institutional consensus. It is usually reliable but it CAN be captured or push a narrative (e.g. evolving COVID guidance). Weigh it as ONE perspective; where it diverges from independent/heterodox sources, say so in middleGround rather than auto-siding with the institution.
- "Establishment vs anti-establishment" is an axis ORTHOGONAL to left/right. When relevant, note it (e.g. an "establishment Democrat" who votes pro-business / for military funding is not the same as the progressive left). Surface these true nuances instead of flattening them to left-vs-right.
- "middleGround": state what the evidence actually supports across all lenses; flag establishment↔independent divergence. Never take a partisan side.`,
          },
          { role: 'user', content: `Claim: "${claim}"\nTopic category: ${category}\n\nEvidence grouped by perspective:\n${labeledEvidence || 'No evidence found.'}\n\nReconcile the perspectives and give your verdict + the factual middle ground.` },
          ], settings),
          buildCounterpoint(claim, settings),
        ])

        let verdict: Verdict = 'UNVERIFIED'
        let verdictSummary = 'No consensus found.'
        let middleGround = ''
        let contradictingSources = 0
        try {
          const v = JSON.parse(verdictRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
          verdict = v.verdict ?? 'UNVERIFIED'
          verdictSummary = v.summary ?? verdictSummary
          middleGround = typeof v.middleGround === 'string' ? v.middleGround : ''
          contradictingSources = Number(v.contradictingSources) || 0
        } catch { /* keep defaults */ }

        // CODE-LEVEL FALSE GUARD — enforce the rule the prompt states. A FALSE verdict requires
        // ≥2 sources that explicitly contradict the claim AND real evidence on the table. Absent
        // that, downgrade to UNVERIFIED. This is the fix for the Weblogs "verifiable → FALSE" bug:
        // the model had no contradicting source, only an absence of mentions.
        if (verdict === 'FALSE' && (contradictingSources < 2 || evidenceItemCount < 2)) {
          verdict = 'UNVERIFIED'
          verdictSummary = 'No sources directly contradict this — not enough evidence to call it false.'
        }

        // SELF-REVIEW PASS — the engine critiques its own verdict against the evidence before
        // showing it. Runs for every claim with real evidence. It can only DOWNGRADE / soften an
        // overreaching verdict (never invent a stronger one), so it's a safety net, not a booster.
        // Catches: (a) absence-treated-as-contradiction, (b) intent vs completed action (the
        // "Yahoo was GOING TO acquire Weblogs" trap — evidence about who actually acquired it does
        // not disprove that a third party was in talks), (c) one-sided framing.
        if (allEvidence.length > 80) {
          const reviewRaw = await callLLM([
            {
              role: 'system',
              content: `You are a strict reviewer auditing a fact-check verdict against ONLY the evidence shown. Respond JSON only: { "supported": true|false, "correctedVerdict": "TRUE"|"MISLEADING"|"FALSE"|"UNVERIFIED"|null, "correctedSummary": "one sentence or null", "note": "one sentence or null" }
Rules:
- You may ONLY weaken/soften an overreaching verdict (TRUE/FALSE → MISLEADING/UNVERIFIED, MISLEADING → UNVERIFIED). NEVER strengthen to TRUE or FALSE.
- ABSENCE IS NOT CONTRADICTION: if sources are silent/off-topic, a FALSE or TRUE is unsupported → UNVERIFIED.
- INTENT vs COMPLETED: if the claim is about a plan/attempt/negotiation ("was going to", "tried to", "planned") but the evidence only addresses what actually happened (or what someone else did), that does NOT make the claim false → UNVERIFIED.
- If the verdict is well-supported, set supported=true and the corrected* fields to null.`,
            },
            {
              role: 'user',
              content: `Claim: "${claim}"
Verdict: ${verdict}
Summary: ${verdictSummary}
Middle ground: ${middleGround || '(none)'}
Counterpoint: ${counterpoint ? counterpoint.fact : '(none)'}
Evidence:
${allEvidence.slice(0, 1400)}

Audit the verdict. Is it actually supported by THIS evidence (no overreach, no absence-as-contradiction, no intent-vs-completed conflation)?`,
            },
          ], settings)

          try {
            const r = JSON.parse(reviewRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
            const rank: Record<Verdict, number> = { FALSE: 3, TRUE: 3, MISLEADING: 2, UNVERIFIED: 1 }
            const cv = r.correctedVerdict as Verdict | null
            // Apply only if the reviewer is STRICTLY weakening the verdict. `<` (not `<=`) is critical:
            // TRUE and FALSE share rank 3, so `<=` would let the reviewer flip a corroborated TRUE
            // straight to FALSE (and vice-versa). `<` permits only TRUE/FALSE → MISLEADING/UNVERIFIED.
            if (r.supported === false && cv && cv !== verdict && rank[cv] < rank[verdict]) {
              verdict = cv
              if (typeof r.correctedSummary === 'string' && r.correctedSummary !== 'null') {
                verdictSummary = r.correctedSummary
              } else if (typeof r.note === 'string' && r.note !== 'null') {
                verdictSummary = r.note
              }
            }
          } catch { /* keep pass-1 verdict */ }
        }

        const card: CounterpointCard = {
          id: claimId,
          claimId,
          claim,
          verdict,
          verdictSummary,
          middleGround: middleGround || undefined,
          counterpoint,
          category,
          spectrum: spectrum as CounterpointCard['spectrum'],
          createdAt: Date.now(),
        }

        Promise.all([
          storeClaim(claim, topic, verdict, verdictSummary, card.spectrum),
          trackSourceUse(
            [...spectrum.establishment, ...spectrum.center, ...spectrum.left, ...spectrum.right, ...spectrum.alt]
              .map(i => { try { return new URL(i.url).hostname.replace('www.', '') } catch { return '' } })
              .filter(Boolean),
            bucket,
            verdict
          ),
        ]).catch(e => console.error('[evidence] KB background save error:', e))

        write({ type: 'done', card })
      } catch (e) {
        console.error('[evidence] stream error:', e)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } })
}
