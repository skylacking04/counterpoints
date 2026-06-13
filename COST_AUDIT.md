# CounterPoints — Cost Audit & Verification Worksheet

> Purpose: a **verifiable** breakdown of every cost driver so the numbers can be audited against
> live provider pricing (by a person or a web-searching LLM). Nothing here is from real invoices
> yet — it's modeled from the code + listed pricing. The point is to make each number *checkable*.
>
> How to verify: for each line, (1) open the **Pricing source** URL, (2) confirm the **Unit price**,
> (3) confirm the **Units consumed** against the code path cited, (4) recompute. Then reconcile
> against the real dashboards in the **Ground-truth** section.

Last modeled: 2026-06-13 · Region: `us-central1` · Cloud Run revision in prod at audit time.

---

## 0. How to read this

- **Unit price** = what the provider charges per token / search / request / GB.
- **Units / claim** or **/ video** = how many of those the code actually consumes (cited to the file).
- **Cost** = Unit price × Units. Monthly = per-claim × claims/month.
- Baseline assumption for monthly totals: **100 videos / 1,000 fresh claims per month**, ~30% cache hit-rate.
- ⚠️ = a number most likely to drift; verify first.

---

## 1. Services, models & pricing sources (verify these URLs)

| # | Service | Exact model / SKU | Pricing source (verify) | Modeled unit price ⚠️ |
|---|---------|-------------------|--------------------------|----------------------|
| 1 | Google Gemini (Vertex AI) | `gemini-2.5-flash` | https://cloud.google.com/vertex-ai/generative-ai/pricing | **$0.30 /1M input tok · $2.50 /1M output tok** ✅ updated 2026-06-13 (was modeled at $0.075/$0.30 — too low) |
| 2 | Google Gemini (Developer API) | `gemini-2.5-flash` | https://ai.google.dev/gemini-api/docs/pricing | free tier + same paid rates ($0.30 / $2.50) |
| 3 | Google Embeddings | `text-embedding-004` | https://ai.google.dev/gemini-api/docs/pricing | ~$0.00002 /1k chars (often free tier) |
| 4 | Groq (Whisper) | `whisper-large-v3` / `-v3-turbo` | https://groq.com/pricing | ⚠️ ~$0.04 /audio-hour (turbo cheaper) |
| 5 | xAI (Grok) | `grok-3` | https://docs.x.ai/docs/models (pricing) | ⚠️ ~$3 /1M input · ~$15 /1M output |
| 6 | Tavily | Search API | https://tavily.com (pricing/dashboard) | 1,000 credits/mo free; then ~$0.008 /credit; 1 search = 1 credit |
| 7 | Jina | `s.jina.ai` (search) + `r.jina.ai` (read) | https://jina.ai (pricing) | free tier tokens, then paid; **fallback only** |
| 8 | YouTube Data API v3 | `videos.list` (snippet,contentDetails) | https://developers.google.com/youtube/v3/determine_quota_cost | **free** — 1 unit/call, 10,000 units/day |
| 9 | Cloud Run | 1 vCPU / 1 GiB, min-instances 0 | https://cloud.google.com/run/pricing | ~$0.000024 /vCPU-s · ~$0.0000025 /GiB-s · free: 180k vCPU-s/mo |
| 10 | Firestore | reads/writes/storage | https://cloud.google.com/firestore/pricing | free: 50k read / 20k write / 1GiB per day; then ~$0.06 /100k reads |
| 11 | Cloud Storage (GCS) | standard storage | https://cloud.google.com/storage/pricing | ~$0.020 /GiB-mo |
| 12 | Webshare | Rotating Residential, 1 GB | https://www.webshare.io/pricing | **$3.50 /mo flat** |
| 13 | OpenAI / Anthropic (BYOK) | `gpt-4o` / `claude-*` | provider pricing | **$0 to us** — only used if the end-user pastes their own key |

> Code references for model names: `src/lib/llm.ts`, `src/lib/genai.ts`, `src/lib/embeddings.ts`,
> `src/lib/groq.ts`, `src/lib/grok-notes.ts`, `src/lib/firecrawl.ts`, `src/app/api/youtube/route.ts`.

---

## 1b. Every billable call, located in the code (line-by-line)

Open each `file:line` and confirm the call exists. **All paid Gemini text calls funnel through one
function** — `callLLM()` → `src/lib/llm.ts:31` (Vertex) with fallback `src/lib/llm.ts:37` (Developer API) —
so you can meter 100% of LLM spend at that single chokepoint.

| Billable thing | What it bills (service) | Exact code location | Fires per |
|----------------|-------------------------|---------------------|-----------|
| `callLLM()` core | Gemini 2.5 Flash text | `src/lib/llm.ts:31` (Vertex), `:37` (Dev API fallback) | every text LLM call below |
| Claim detection | Gemini Flash | `src/app/api/analyze/route.ts:55` | **every analyze tick** (3–5s) |
| Spectrum quote (L/C/R) | Gemini Flash | `src/app/api/evidence/route.ts:86` | per article × 3 lenses |
| Alt article quote | Gemini Flash | `src/app/api/evidence/route.ts:134` | per alt article |
| Alt video quote | Gemini Flash | `src/app/api/evidence/route.ts:153` | per alt video |
| X relevance gate | Gemini Flash | `src/app/api/evidence/route.ts:23` (`validateXPosts`) | 1 / claim |
| Verdict | Gemini Flash | `src/app/api/evidence/route.ts:270` | 1 / claim |
| Verify (TRUE/FALSE) | Gemini Flash | `src/app/api/evidence/route.ts:301` | 0–1 / claim |
| Reconcile (CC vs live) | Gemini Flash | `src/app/api/reconcile/route.ts:30` | every 25s when dual-source |
| Full Analysis (on-demand) | Gemini Flash | `src/app/api/compare/route.ts:44` | only when user clicks "Full Analysis" |
| Manual verify route | Gemini Flash | `src/app/api/verify/route.ts:25` | per manual check |
| Vision (frame read) | Gemini Flash (image) | `src/app/api/vision/route.ts` (via `ai.models.generateContent`) | 1 / claim if a frame exists |
| Grounded web search | Gemini Flash + Google Search | `src/lib/gemini-search.ts:36–38` | search fallback per lens |
| Embeddings | `text-embedding-004` | `src/lib/embeddings.ts:20` | 2 / claim (cache lookup + store) |
| **Tavily search** | Tavily credits | `src/lib/firecrawl.ts:107` (def), called `:66` + `:82`; per-lens via `searchArticles` at `evidence/route.ts:70,74,124` | ~4–8 / claim |
| **Grok-3** | xAI tokens | `src/lib/grok-notes.ts:153` (endpoint), `:160` (model) — via `searchGrokNotes` at `evidence/route.ts:42`, `verify/route.ts:13` | 1 / claim |
| **Whisper** | Groq audio-seconds | `src/lib/groq.ts:8` (`whisper-large-v3-turbo`), `:41` (`whisper-large-v3`) | per audio chunk while capturing |
| YouTube metadata | YouTube Data API (free) | `src/app/api/youtube/route.ts:43` | 1 / video |
| YouTube channel search | YouTube Data API (free) | `src/lib/youtube-search.ts:63` | alt-lens video search |
| Analyze loop interval | (drives the above) | `src/app/app/page.tsx:496` (`3_000 : 5_000`), `:497` `setInterval` | the cadence knob |
| Reconcile loop interval | (drives reconcile) | `src/app/app/page.tsx:477` + `:489` (`25_000`) | dual-source only |

**The `$0` (cached) paths — verify these guards short-circuit before any paid call:**
- Transcript cache hit → returns early: `src/app/api/youtube/route.ts:132–133` (`getCachedTranscript`).
- Claim cache hit → returns the stored card, **skips all lenses/verdict**: `src/app/api/evidence/route.ts:194` (`findCachedClaim`, skipped when `noCache`) and the serve guard `:206` (`cachedArticleCount > 0`).
- `noCache:true` (the "Re-run sources" button) **forces** the paid path: same `evidence/route.ts:194`.

> Verification tip: set a breakpoint / `console.count()` at `src/lib/llm.ts:31`, Tavily `firecrawl.ts:107`,
> and Grok `grok-notes.ts:153`. Run one fresh claim and one cached claim — the counts you see ARE the
> per-claim numbers in §2 (cached should be ~0 paid calls).

---

## 2. Call-counting: what one FRESH fact-check consumes

Traced through `src/app/api/evidence/route.ts` (the `POST` handler) + `processClaim` in
`src/app/app/page.tsx`. "Fresh" = not served from the knowledge-base cache.

| Step | Code path | LLM (Gemini Flash) calls | Search calls | Other |
|------|-----------|--------------------------|--------------|-------|
| Cache lookup | `findCachedClaim` | — | — | 1 embedding (text-embedding-004) |
| Vision (if video frame) | `/api/vision` in `processClaim` | 1 | — | — |
| Left lens | `buildSpectrumItems('left')` | up to 2 (one quote/article) | 1–2 Tavily (then Gemini/Jina) | — |
| Center lens | `buildSpectrumItems('center')` | up to 2 | 1–2 Tavily | — |
| Right lens | `buildSpectrumItems('right')` | up to 2 | 1–2 Tavily | — |
| Alt lens | `buildAltItems` | up to 3 (1 article + 2 video) | 1–2 Tavily + YouTube channel search | — |
| X / Community lens | `buildGrokLens` | 1 (relevance gate) | 1 Grok-3 call (or Jina/Tavily fallback) | — |
| Verdict | `callLLM` verdict | 1 | — | — |
| Verify (TRUE/FALSE only) | `callLLM` verify | 0–1 | — | — |
| Store to KB | `storeClaim` | — | — | 1 embedding + Firestore writes |

**Per fresh claim (corrected with real Gemini pricing):**
- Gemini Flash calls: **~12–14**, each ~800 input + ~150 output tokens ⇒ ~11k in / ~2k out ⇒
  `11k×$0.30/1M + 2k×$2.50/1M` ≈ **$0.008** (was $0.0014 under the old rate)
- Embeddings: 2 × ~500 chars ⇒ **< $0.001** (often free tier)
- Grok-3: 1 × ~1k in / ~500 out ⇒ `1k×$3/1M + 0.5k×$15/1M` ≈ **$0.0105** ⚠️ (priciest single call)
- Tavily: **~4–8 searches** ⇒ free within 1,000/mo; else ~$0.03–0.06
- **Total fresh claim ≈ $0.05–0.09** (dominated by Tavily + Grok; Gemini now a meaningful share). **Cached claim ≈ $0.00.**

---

## 3. Call-counting: what one VIDEO consumes

| Driver | Code path | Volume (10-min video) | Cost note |
|--------|-----------|------------------------|-----------|
| Transcript fetch | `/api/youtube` | 1× InnerTube (free) → yt-dlp (free, uses proxy GB) → Gemini transcript fallback (1 Gemini call only if needed) | mostly free; cached cross-user 7 days |
| Metadata | `fetchVideoMeta` | 1 YouTube API unit | free |
| ⚠️ Claim-scan loop | `analyzeNow` every **3s live / 5s preloaded** (`src/app/app/page.tsx` ~line 496) | ~120–200 `/api/analyze` Gemini calls | **biggest hidden driver** — see §5 |
| Reconcile (CC vs live) | `/api/reconcile` every 25s | ~24 Gemini calls (only if both sources active) | — |
| Live transcription | `/api/transcribe` (Groq Whisper) | continuous while capturing | ~$0.04/audio-hour |
| Fact-checks | `/api/evidence` × (claims found) | ~5–15 claims/video | §2 cost each |

**Per fresh 10-min video (corrected):** ~$0.40–1.00+ depending on #claims and whether the analyze
loop + Whisper run the whole time. Cached video re-loads ≈ free.

---

## 4. Monthly projection (show the math)

Assumption: **100 videos, 1,000 fresh claims, ~30% cache hits, moderate live-capture.**

| Line | Math | Corrected $/mo |
|------|------|----------------|
| Tavily | (1,000 claims × ~5 searches) = 5,000 credits − 1,000 free = 4,000 × $0.008 | **~$25–40** ⚠️ |
| Grok-3 | 1,000 claims × $0.0105 | **~$10–11** |
| Gemini Flash (claims) | 1,000 × ~$0.008 (corrected rate) | **~$8** |
| Gemini Flash (analyze loop) | ~100 videos × ~150 calls × ~$0.0008 (corrected) | **~$2–4** ⚠️ |
| Groq Whisper | ~20 live-hours × $0.04 | **~$0.5–1** |
| Embeddings | negligible | **< $1** |
| Cloud Run | ~1,000 claims × ~30 vCPU-s − 180k free | **~$2–6** |
| Firestore | mostly free tier at this volume | **~$0–3** |
| Webshare proxy | flat | **$3.50** |
| YouTube API / GCS / Jina | free tier / fallback | **~$0** |
| **TOTAL** | | **≈ $65–95 / mo** |

The only **fixed** cost is the **$3.50 proxy**; everything else is usage-based and scales to **$0 at idle**
(Cloud Run min-instances 0). Cache hit-rate is the biggest swing factor — higher hits → lower Tavily/Grok.

> **Revision note (2026-06-13):** Gemini 2.5 Flash pricing was previously modeled at $0.075/$0.30 per 1M
> (the old Flash rate). Verified current pricing is **$0.30 input / $2.50 output per 1M**, which raises the
> Gemini lines ~5–6× and the monthly total from ~$55–70 to **~$65–95**. A slower analyze loop (8–10s) or
> higher cache hit-rate brings it back under ~$60. All other lines (Grok-3, Tavily, Whisper, embeddings)
> verified accurate.

---

## 5. Cost-overload risks (audit these first)

1. ⚠️ **Analyze loop frequency** — fires every 3–5s per playing video (`page.tsx`). High call count → drives Gemini rate-limits (429s) and creep. *Lever: raise interval to 8–10s.*
2. ⚠️ **Tavily past 1,000 free credits** — pay-as-you-go; a heavy month of fresh videos is the main variable spend.
3. ⚠️ **Grok-3 output tokens** — priciest per call; the first thing to cap/cache at scale.
4. **Continuous Whisper** during long live streams.
5. **No global rate-limit / per-user cap** in code today — add one before any public launch.

---

## 6. Ground-truth: reconcile against real dashboards

To turn this from "modeled" into "audited," pull one month of actuals:

- [ ] **Tavily** dashboard → credits used this month (https://app.tavily.com).
- [ ] **GCP Billing** → export by SKU: Vertex AI, Cloud Run, Firestore, GCS (https://console.cloud.google.com/billing).
- [ ] **Gemini Developer API** usage (https://aistudio.google.com → API usage).
- [ ] **xAI** console → Grok token spend (https://console.x.ai).
- [ ] **Groq** console → audio-seconds billed (https://console.groq.com).
- [ ] **Webshare** → bandwidth used vs 1 GB (https://dashboard.webshare.io).
- [ ] **YouTube API** quota usage (https://console.cloud.google.com/apis → YouTube Data API).

Then replace each "modeled $/mo" above with the invoice number and note the variance.

---

## 7. Where to cut cost (verify impact after each change)

- **Cache aggressively** — transcript cache (Firestore, 7-day) + knowledge-base claim cache make repeats free. Highest leverage.
- **Slow the analyze loop** 3-5s → 8-10s (cuts Gemini ~2×).
- **Cap/cache the Grok lens** — only call on contentious claims; reuse stored X results.
- **Trim lenses** — Center + the 2 relevant sides instead of all 5 cuts Tavily ~40%.
- **Go local** for the high-frequency, low-stakes calls (see §8). Keep Gemini for the final verdict.

---

## 8. Local-model option (near-zero marginal cost)

| Replace | With (local) | Removes | Trade-off |
|---------|--------------|---------|-----------|
| Groq Whisper | `faster-whisper` | per-audio-hour cost | needs GPU for real-time |
| Gemini Flash (analyze, quotes) | Llama 3.1 / Qwen 2.5 via Ollama | most LLM cost + rate-limits | lower quality; keep Gemini for verdict |
| text-embedding-004 | `sentence-transformers` | embedding cost | tiny quality diff |
| Tavily | self-hosted SearXNG | search credits | less clean; you host it |

Realistic plan: **one GPU worker** runs Whisper + a small LLM for the hot path (claim detection,
quote extraction, embeddings); cloud Gemini stays only for the final verdict. Kills the rate limits
and ~80% of marginal cost while keeping verdict quality.

---

## 9. LLM audit prompt (paste into a web-searching model to verify pricing)

```
You are a cost auditor. Verify the pricing assumptions in this worksheet against CURRENT public
pricing. For EACH row in the "Services, models & pricing sources" table:
1. Open the pricing source URL (or search the web for the provider's current pricing).
2. Report the provider's current unit price for the exact model/SKU named.
3. Compare it to the "Modeled unit price" column; flag any difference > 10%.
4. Note any pricing changes, new free-tier limits, or deprecations since 2026-06-13.

Then recompute the "Monthly projection" table (§4) using the verified prices and the SAME usage
assumptions (100 videos, 1,000 fresh claims, ~30% cache, ~20 live-hours). Output a corrected total
and a per-line variance vs the modeled figures. Call out the top 3 cost drivers and the single
biggest pricing risk. List any model/SKU you could not verify.
```

Paste the tables from §1 and §4 alongside this prompt.

---

*Estimates only — not audited billing. Verify §1 prices and reconcile against §6 before quoting these numbers anywhere official.*
