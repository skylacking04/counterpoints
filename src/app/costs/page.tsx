'use client'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Server, Search, Brain, Mic, Database, Globe, AlertTriangle, TrendingDown, Cpu, Zap, CheckCircle2, Layers } from 'lucide-react'

// ─── TWiST bounty spec → how CounterPoints meets it ──────────────────────────────────
const SPEC = [
  { req: 'Real-time: listen to the show live and give feedback in a sidebar', how: 'Tab/mic audio captured in-browser and transcribed every few seconds (Whisper via Groq); claims auto-scan on a rolling window. Fact-check cards stream into the side panel live.' },
  { req: 'Fact-checker: monitor for factual claims, give corrections + background data', how: 'Every claim is checked across Left / Center / Right / Alt media + X Community Notes, then reconciled into a verdict (TRUE / MISLEADING / FALSE / UNVERIFIED) with a one-line "the actual facts" middle-ground summary and cited sources.' },
  { req: 'Transcript shown in real time, linked to the commentary', how: 'Live rolling transcript with each checked claim highlighted and click-linked to its fact-check card; clicking a card jumps the video + transcript to that moment.' },
  { req: '(Bonus) Production-ready', how: 'Cross-user knowledge-base cache (repeat claims are instant + free), session history per email, scales to zero on Cloud Run, ~$0.05–$0.09 per fresh claim.' },
]

// ─── How it's built (architecture) — bounty-appropriate, no secrets ───────────────────
const ARCH = [
  { step: '1 · Capture', detail: 'YouTube URL → real captions via a resilient chain (YouTube InnerTube → yt-dlp → AI transcription fallback). Live shows → browser tab/mic audio → Whisper (Groq). Transcripts cached cross-user in Firestore (7-day).' },
  { step: '2 · Detect', detail: 'A lightweight Gemini pass scans the rolling transcript every few seconds for factual claims (stats, history, science, politics) with confidence scoring + de-duplication so each claim fires once.' },
  { step: '3 · Research', detail: 'Per claim, 5 lenses run in parallel — Left / Center / Right / Alt articles (Tavily + Gemini grounding + Jina) and X Community Notes (xAI Grok). A batched LLM gate drops off-topic / non-factual results.' },
  { step: '4 · Reconcile', detail: 'Evidence is labeled by side and a verdict model finds the factual middle ground — cutting through Fox-vs-MSNBC framing to "what is actually verifiable." A second pass guards TRUE/FALSE against contradiction.' },
  { step: '5 · Learn', detail: 'Each claim + verdict is embedded and stored. Future similar claims answer instantly from the knowledge base — so cost and latency fall as usage grows.' },
]

// ─── Cost data (estimates, USD/month). Tiers: free / cheap / watch / spend ───────────
type Tier = 'free' | 'cheap' | 'watch' | 'spend'
const TIER: Record<Tier, { label: string; cls: string }> = {
  free:  { label: 'FREE TIER',  cls: 'text-green-300 bg-green-500/10 border-green-500/25' },
  cheap: { label: 'CHEAP',      cls: 'text-sky-300 bg-sky-500/10 border-sky-500/25' },
  watch: { label: 'WATCH',      cls: 'text-amber-300 bg-amber-500/10 border-amber-500/25' },
  spend: { label: 'MAIN SPEND', cls: 'text-red-300 bg-red-500/10 border-red-500/25' },
}

interface Row { service: string; usedFor: string; pricing: string; est: string; tier: Tier }

const SERVICES: { group: string; icon: React.ReactNode; rows: Row[] }[] = [
  {
    group: 'AI / LLM',
    icon: <Brain size={16} />,
    rows: [
      { service: 'Gemini 2.5 Flash (Vertex AI)', usedFor: 'Claim detection, verdict, quote extraction, vision, reconcile, compare, transcript fallback, search grounding', pricing: '$0.30 / 1M input · $2.50 / 1M output (verified Jun 2026). Has a free per-minute quota we hit (429 rate limits).', est: '$8 – $14', tier: 'watch' },
      { service: 'Gemini 2.5 Flash (Developer API)', usedFor: 'Overflow / fallback when Vertex is rate-limited (separate quota pool)', pricing: 'Free tier + same paid rates. Currently absorbs Vertex overflow.', est: '$0 – $3', tier: 'cheap' },
      { service: 'text-embedding-004 (Vertex)', usedFor: 'Knowledge-base semantic matching (cache hits for repeat claims)', pricing: '~$0.000025 / 1k chars — negligible', est: '< $1', tier: 'free' },
      { service: 'Grok-3 (xAI)', usedFor: 'X / Community Notes search per claim (0–1 call; falls back to Jina + Tavily if key not configured)', pricing: '~$3 / 1M input · $15 / 1M output — most expensive per call', est: '$5 – $15', tier: 'spend' },
      { service: 'Whisper large-v3 (Groq)', usedFor: 'Live tab/mic audio → transcript (only when capturing)', pricing: '~$0.04 / hour of audio', est: '$1 – $5', tier: 'cheap' },
      { service: 'GPT-4o / Claude (BYOK)', usedFor: 'Optional — only if a user pastes their own key in Settings', pricing: 'Paid by the user, not us', est: '$0', tier: 'free' },
    ],
  },
  {
    group: 'Search & Sources',
    icon: <Search size={16} />,
    rows: [
      { service: 'Tavily', usedFor: 'Primary web search for Left/Center/Right/Alt article sources (~5–8 searches typical; up to ~15 when Gemini grounding + Jina fallback chain fires)', pricing: 'Researcher plan: 1,000 credits/mo free (~200 fresh claims), then ~$0.008/credit. 1 search = 1 credit.', est: '$0 – $40', tier: 'spend' },
      { service: 'Jina (s.jina.ai / r.jina.ai)', usedFor: 'Search + page-read fallback when Tavily/Gemini miss', pricing: 'Free tier (~1M tokens), then paid. Used as fallback only.', est: '$0 – $5', tier: 'cheap' },
      { service: 'YouTube Data API', usedFor: 'Video title / channel / duration metadata', pricing: 'Free — 10,000 units/day quota (metadata = 1 unit)', est: '$0', tier: 'free' },
      { service: 'yt-dlp + captions', usedFor: 'Real closed-caption fetch when InnerTube is blocked', pricing: 'Free software; runs on Cloud Run CPU', est: '$0', tier: 'free' },
    ],
  },
  {
    group: 'Infrastructure',
    icon: <Server size={16} />,
    rows: [
      { service: 'Cloud Run', usedFor: 'Hosts the whole app (Next.js + API + yt-dlp)', pricing: '1 vCPU / 1 GiB, min-instances 0 (scales to zero). ~$0.000024/vCPU-s. Free tier: 180k vCPU-s/mo.', est: '$2 – $8', tier: 'cheap' },
      { service: 'Webshare Residential Proxy', usedFor: 'Residential IP so yt-dlp can fetch captions (YouTube blocks datacenter IPs)', pricing: 'Flat $3.50/mo (Rotating Residential, 1 GB)', est: '$3.50', tier: 'cheap' },
      { service: 'Firestore', usedFor: 'Sessions, transcript cache, knowledge base (claims + embeddings), source stats', pricing: 'Free tier: 50k reads / 20k writes / day. Then ~$0.06/100k reads.', est: '$0 – $5', tier: 'cheap' },
      { service: 'Cloud Storage (GCS)', usedFor: 'Audio + transcript files', pricing: '~$0.02 / GB / month', est: '< $1', tier: 'free' },
    ],
  },
]

const RISKS = [
  { title: 'The analyze loop fires every 3–5 seconds', body: 'While a video plays, the app calls Gemini to scan for new claims every few seconds. Per long video that\'s dozens–hundreds of Gemini calls. This is the #1 driver of the Vertex 429 rate limits and silent cost creep at scale.' },
  { title: 'Tavily pay-as-you-go after 1,000 credits per key', body: 'Each claim runs ~5–8 Tavily searches. 1,000 free credits ≈ 125–200 fresh claims/key. Rotating multiple Tavily keys (TAVILY_KEY, TAVILY_KEY_2, TAVILY_KEY_3) multiplies the free pool. Past quota it\'s ~$0.008/credit. The knowledge-base cache means repeat claims cost $0.' },
  { title: 'Grok-3 is the priciest per call', body: 'At $15/1M output tokens, the X-Community lens is the most expensive single call per claim. If volume grows, this is the first thing to cap or cache.' },
  { title: 'Live capture (Whisper) runs continuously', body: 'When tab/mic capture is on, Groq transcribes audio nonstop. Long live sessions add up. Fine occasionally, watch it for hours-long streams.' },
]

const SAVE = [
  { title: 'Cache everything (already partly done)', body: 'Transcript cache (Firestore, 7-day) makes repeat videos free. Knowledge-base claim cache makes repeat/similar claims free. Keeping these healthy is the single biggest lever — most cost is first-load only.' },
  { title: 'Slow the analyze loop', body: 'Drop the claim-scan interval from 3-5s to 8-10s. Cuts Gemini analyze calls ~2× with little UX loss — and directly relieves the Vertex 429s.' },
  { title: 'Cap or cache the Grok / X lens', body: 'Only call Grok when the claim is politically/factually contentious, or cache X results in the knowledge base alongside the verdict (already stored — make sure it\'s reused).' },
  { title: 'Right-size searches per claim', body: 'We fetch 2 articles × multiple lenses. Trimming to the 3 strongest lenses (Center + the two relevant sides) cuts Tavily credits ~40%.' },
  { title: 'Use the free tiers deliberately', body: 'Cloud Run min-instances 0 (no idle cost), Firestore free tier, YouTube API free quota, Developer-API Gemini for overflow. Already configured — just don\'t add an always-on instance.' },
]

const LOCAL = [
  { model: 'Whisper → faster-whisper (local)', swap: 'Replaces Groq Whisper', cost: 'Free (CPU/GPU you own)', tradeoff: 'Needs a GPU for real-time; CPU is slower. Best if you self-host a worker.' },
  { model: 'Claim detection / quotes → Llama 3.1 / Qwen 2.5 (Ollama)', swap: 'Replaces Gemini Flash for the simple, high-frequency calls (analyze, quote extraction)', cost: 'Free', tradeoff: 'Lower quality than Flash; fine for "is this a claim?" and one-sentence summaries. Keep Gemini for the final verdict.' },
  { model: 'Embeddings → sentence-transformers (local)', swap: 'Replaces text-embedding-004', cost: 'Free', tradeoff: 'Tiny quality difference for cache matching; easy win if self-hosting.' },
  { model: 'Search → SearXNG (self-hosted meta-search)', swap: 'Reduces Tavily dependence', cost: 'Free (you host it)', tradeoff: 'Less clean than Tavily; needs a small server + maintenance.' },
]

const SPEED = [
  { title: 'Developer API is already primary for search; consider it for verdict too', body: 'Search/grounding calls hit the Developer API first (separate quota pool, rarely rate-limited). Verdict/analyze calls hit Vertex first and fall back to Developer API on 429. If Vertex 429s are frequent, flipping verdict calls to Developer-API-first cuts the retry delay ~2s per call.' },
  { title: 'Tavily-first search (done)', body: 'We reordered so the fast working Tavily key runs before slow Gemini grounding — sources now stream in ~10s.' },
  { title: 'Fewer LLM hops per claim', body: 'Each lens does a quote-extraction call + there\'s a verdict + a verify pass. Merging quote extraction into the search step (or using the article snippet) removes a serial round-trip.' },
  { title: 'Local inference for the hot path', body: 'The 3-5s analyze loop is the most latency-sensitive. A local small model (Ollama) answers in <1s with no rate limits.' },
  { title: 'Keep the caches warm', body: 'Cache hits return in ~0.3s. The more the knowledge base fills, the faster (and cheaper) everything gets.' },
]

function TierBadge({ tier }: { tier: Tier }) {
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${TIER[tier].cls}`}>{TIER[tier].label}</span>
}

export default function CostsPage() {
  return (
    <div className="min-h-screen bg-[#070710] text-white">
      {/* Nav */}
      <nav className="border-b border-white/8 px-5 py-3 flex items-center gap-3 bg-[#0d0d14] sticky top-0 z-10">
        <Link href="/app" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={16} /> Back to App
        </Link>
        <div className="flex-1" />
        <Image src="/counterpoints.png" alt="CounterPoints" width={120} height={80} className="h-10 w-auto" />
      </nav>

      <main className="max-w-4xl mx-auto px-5 py-10">
        {/* Hero */}
        <div className="inline-block text-[10px] font-bold px-2 py-1 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 mb-3">TWiST $5K BOUNTY SUBMISSION — REAL-TIME PODCAST FACT-CHECKER</div>
        <h1 className="text-3xl font-bold mb-2">CounterPoints — How it works, &amp; what it costs</h1>
        <p className="text-gray-400 text-sm max-w-2xl mb-4">
          A real-time fact-checking sidebar for podcasts &amp; YouTube shows. Below: how it meets the spec, how it&apos;s built,
          what it costs to run, and how it scales. Cost figures are <strong className="text-white">modeled estimates</strong> from
          the codebase + public pricing (not audited billing) at an assumed <strong className="text-white">~100 videos / ~1,000 claims per month</strong>.
        </p>
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[11px] text-amber-200/80 mb-8">
          <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-300" />
          <span>Disclaimer: dollar figures are estimates modeled from code + listed provider pricing, not audited invoices. Actuals vary with usage, provider changes, and cache hit-rate.</span>
        </div>

        {/* Summary cards */}
        <div className="grid sm:grid-cols-3 gap-3 mb-10">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
            <div className="text-xs text-gray-500 mb-1">Est. monthly total</div>
            <div className="text-2xl font-bold text-white">$65 – $95</div>
            <div className="text-[11px] text-gray-500 mt-1">at ~1,000 claims/mo · verified Jun 2026</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
            <div className="text-xs text-gray-500 mb-1">Fixed monthly floor</div>
            <div className="text-2xl font-bold text-sky-300">~$3.50</div>
            <div className="text-[11px] text-gray-500 mt-1">Webshare proxy (only always-on cost)</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
            <div className="text-xs text-gray-500 mb-1">Biggest variable spend</div>
            <div className="text-2xl font-bold text-red-300">Tavily + Grok</div>
            <div className="text-[11px] text-gray-500 mt-1">scale with fresh-claim volume</div>
          </div>
        </div>

        {/* Meets the bounty spec */}
        <section className="mb-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white/90 mb-3"><CheckCircle2 size={16} className="text-green-300" /> Meets the bounty spec</h2>
          <div className="space-y-2">
            {SPEC.map(s => (
              <div key={s.req} className="rounded-xl border border-green-500/20 bg-green-500/[0.04] p-4 flex gap-3">
                <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-white mb-0.5">{s.req}</div>
                  <p className="text-xs text-gray-400">{s.how}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it's built */}
        <section className="mb-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white/90 mb-3"><Layers size={16} className="text-violet-300" /> How it&apos;s built</h2>
          <div className="rounded-xl border border-white/8 overflow-hidden">
            {ARCH.map((a, i) => (
              <div key={a.step} className={`p-4 ${i > 0 ? 'border-t border-white/6' : ''} bg-[#0d0d14] flex gap-3`}>
                <span className="text-[11px] font-bold text-violet-300 shrink-0 w-20">{a.step}</span>
                <p className="text-xs text-gray-400 flex-1">{a.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <h2 className="text-lg font-semibold text-white/90 mb-3 mt-2 border-t border-white/8 pt-8">What it costs to run</h2>

        {/* Per-service tables */}
        {SERVICES.map(group => (
          <section key={group.group} className="mb-8">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white/90 mb-3">
              <span className="text-indigo-300">{group.icon}</span> {group.group}
            </h2>
            <div className="rounded-xl border border-white/8 overflow-hidden">
              {group.rows.map((r, i) => (
                <div key={r.service} className={`p-4 ${i > 0 ? 'border-t border-white/6' : ''} bg-[#0d0d14]`}>
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <span className="font-medium text-sm text-white">{r.service}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <TierBadge tier={r.tier} />
                      <span className="text-sm font-mono text-gray-300">{r.est}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-1">{r.usedFor}</p>
                  <p className="text-[11px] text-gray-400">{r.pricing}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Cost per claim */}
        <section className="mb-10 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.05] p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white/90 mb-3"><Zap size={16} className="text-indigo-300" /> Where the money goes — per fact-check</h2>
          <ul className="space-y-1.5 text-sm text-gray-300">
            <li className="flex justify-between"><span>~5–8 Tavily searches (typical; up to 15 in heavy fallback)</span><span className="font-mono text-gray-400">~$0.04–$0.12 (or free in quota)</span></li>
            <li className="flex justify-between"><span>~14–20 Gemini Flash calls (quotes + verdict + self-review + counterpoint)</span><span className="font-mono text-gray-400">~$0.01–$0.015</span></li>
            <li className="flex justify-between"><span>0–1 Grok-3 call (X Community; Jina fallback if key absent)</span><span className="font-mono text-gray-400">~$0–$0.01</span></li>
            <li className="flex justify-between"><span>2 embeddings (cache lookup + store)</span><span className="font-mono text-gray-400">&lt; $0.001</span></li>
            <li className="flex justify-between border-t border-white/10 pt-1.5 mt-1.5 font-semibold text-white"><span>≈ per fresh claim (typical)</span><span className="font-mono">~$0.05 – $0.09</span></li>
            <li className="flex justify-between text-amber-200/80"><span>≈ per fresh claim (heavy fallback, no quota)</span><span className="font-mono">up to ~$0.15</span></li>
            <li className="flex justify-between text-green-300"><span>repeat / cached claim (cosine ≥ 0.92)</span><span className="font-mono">$0.00</span></li>
          </ul>
          <p className="text-[11px] text-gray-500 mt-3">The transcript + claim caches are what keep this low — most real-world videos share trending claims, so cache hit rate climbs over time. Typical cost assumes Tavily quota is healthy; worst-case fires when all fallback chains run.</p>
        </section>

        {/* Risks */}
        <section className="mb-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white/90 mb-3"><AlertTriangle size={16} className="text-amber-300" /> Cost overload risks</h2>
          <div className="space-y-2">
            {RISKS.map(r => (
              <div key={r.title} className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                <div className="text-sm font-semibold text-amber-200/90 mb-1">{r.title}</div>
                <p className="text-xs text-gray-400">{r.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Save */}
        <section className="mb-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white/90 mb-3"><TrendingDown size={16} className="text-green-300" /> Where to cut cost</h2>
          <div className="space-y-2">
            {SAVE.map(r => (
              <div key={r.title} className="rounded-xl border border-green-500/20 bg-green-500/[0.04] p-4">
                <div className="text-sm font-semibold text-green-200/90 mb-1">{r.title}</div>
                <p className="text-xs text-gray-400">{r.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Local models */}
        <section className="mb-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white/90 mb-3"><Cpu size={16} className="text-violet-300" /> Going local (self-hosted, near-zero marginal cost)</h2>
          <div className="rounded-xl border border-white/8 overflow-hidden">
            {LOCAL.map((r, i) => (
              <div key={r.model} className={`p-4 ${i > 0 ? 'border-t border-white/6' : ''} bg-[#0d0d14]`}>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <span className="font-medium text-sm text-white">{r.model}</span>
                  <span className="text-xs font-mono text-green-300 shrink-0">{r.cost}</span>
                </div>
                <p className="text-xs text-gray-400">Replaces: {r.swap}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Trade-off: {r.tradeoff}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-3">
            Realistic plan: keep Gemini for the <em>final verdict</em> (quality matters), move the high-frequency, low-stakes calls (claim detection, quote extraction, embeddings, Whisper) to local models on a single GPU worker. That removes the rate limits and most marginal cost while keeping verdict quality.
          </p>
        </section>

        {/* Speed */}
        <section className="mb-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white/90 mb-3"><Globe size={16} className="text-sky-300" /> How to speed it up</h2>
          <div className="space-y-2">
            {SPEED.map(r => (
              <div key={r.title} className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4">
                <div className="text-sm font-semibold text-sky-200/90 mb-1">{r.title}</div>
                <p className="text-xs text-gray-400">{r.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Verify these numbers */}
        <section className="mb-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white/90 mb-3"><CheckCircle2 size={16} className="text-green-300" /> How to verify these numbers (don&apos;t take our word)</h2>
          <p className="text-xs text-gray-400 mb-3">
            Every figure here is <strong className="text-white">modeled</strong> from the codebase + listed pricing, not pulled from invoices.
            A full <span className="font-mono text-indigo-300">COST_AUDIT.md</span> worksheet ships in the repo with the per-claim call math,
            the exact model/SKU for each line, the pricing-page URL to check, and a ready-to-paste prompt for a web-searching LLM to re-price it.
          </p>
          <div className="rounded-xl border border-white/8 overflow-hidden text-xs">
            {[
              ['Tavily dashboard', 'credits used this month vs the 1,000 free'],
              ['GCP Billing (by SKU)', 'Vertex AI · Cloud Run · Firestore · GCS actuals'],
              ['xAI / Groq consoles', 'Grok-3 token spend · Whisper audio-seconds'],
              ['Webshare dashboard', 'proxy bandwidth vs the 1 GB plan'],
            ].map(([k, v], i) => (
              <div key={k} className={`flex gap-3 p-3 ${i > 0 ? 'border-t border-white/6' : ''} bg-[#0d0d14]`}>
                <CheckCircle2 size={14} className="text-gray-400 shrink-0 mt-0.5" />
                <span><strong className="text-white">{k}</strong> — <span className="text-gray-400">{v}</span></span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-2">Reconcile each modeled line against these dashboards to turn estimates into an audited figure.</p>
        </section>

        {/* Footer note */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-[11px] text-gray-500 flex gap-2">
          <Database size={14} className="text-gray-400 shrink-0 mt-0.5" />
          <span>
            All figures are estimates and move with usage and provider pricing. The cheapest path to scale is aggressive caching + slowing the analyze loop + moving high-frequency calls local. The proxy ($3.50/mo) is the only true fixed cost; everything else scales to near-zero at idle because Cloud Run runs at min-instances 0.
          </span>
        </div>

        <div className="mt-8 flex items-center gap-2">
          <Mic size={14} className="text-gray-400" />
          <span className="text-[11px] text-gray-400">Generated from the live codebase — models, endpoints, and Cloud Run config as deployed.</span>
        </div>
      </main>
    </div>
  )
}
