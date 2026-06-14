# CounterPoints

**Real-time, non-partisan fact-checking sidebar for podcasts & YouTube shows.**
Paste a URL (or capture live audio) → see a rolling transcript, claims auto-flagged, and each
claim checked across **𝕏 Community Notes · Establishment · Center · Left · Right · Alt media**,
then reconciled into a verdict with the *actual facts* in the middle — plus a **Counterpoint**: the
single opposing fact that challenges the claim (claim *"the rich should pay more"* → *"the top 1%
already pay ~40% of federal income tax"*, sourced).

Every topic gets every perspective — not just politics. Tech, business, taxes, science all have
sides, so all sides are shown. A self-review pass audits each verdict before it's displayed.

Built for the [This Week in Startups $5K "Fact Checker for Podcasts" bounty](https://launch1.notion.site/5K-Bounty-Create-a-Fact-Checker-App-for-Podcasts).

- **GitHub:** https://github.com/skylacking04/counterpoints
- **Live app:** https://counterpoints-app-zdku5kri5a-uc.a.run.app
- **Cost & architecture page:** https://counterpoints-app-zdku5kri5a-uc.a.run.app/costs
- **Cost audit worksheet:** [`COST_AUDIT.md`](./COST_AUDIT.md)

> **Runs fully locally** with `npm run dev` — no cloud deploy needed to try it. (Cloud Run deploy is optional, for hosting.)

---

## What it does (meets the bounty spec)

| Bounty requirement | How CounterPoints does it |
|---|---|
| **Real-time** — listen live, feedback in a sidebar | Tab/mic audio captured in-browser, transcribed every few seconds (Whisper via Groq); fact-check cards stream into the side panel live. Dual transcript tabs — **Live Audio** (capture) and **CC** (loaded captions) — both transcribe in the background. |
| **Fact-checker** — flag claims, give corrections + background | A memory-aware gatekeeper LLM reviews every sentence ("should this be checked?"), then each claim is checked across 6 perspectives, reconciled into TRUE / MISLEADING / FALSE / UNVERIFIED with a one-line "the actual facts" middle-ground, a **Counterpoint** (the opposing fact), and cited sources. A self-review pass then audits the verdict (catches absence-as-contradiction and intent-vs-completed errors). |
| **Real-time transcript** linked to commentary | Rolling transcript with each checked claim highlighted and click-linked to its fact-check card; clicking a card jumps the video + transcript to that moment. |

Plus: passwordless email login + history, a cross-user knowledge-base cache (repeat claims are
instant **and free**), an isolated **`/sync-test`** transcript-QA page (compare captions vs Whisper
with a live drift readout), and it scales to zero on Cloud Run.

---

## How it works

```
URL / live audio
   │
   ├─ Capture     InnerTube captions  ·  tab/mic audio → Whisper (Groq)  ·  yt-dlp+proxy fallback   (cached)
   ├─ Gatekeeper  Gemini reviews every sentence: "is this a verifiable claim worth checking?" (memory-aware, deduped)
   ├─ Research    6 lenses in parallel — 𝕏 Community (xAI Grok) · Establishment · Center · Left · Right · Alt
   │              (Tavily + Gemini grounding + Jina), per-topic source pools so every subject gets every side
   ├─ Counterpoint  Derive the decisive opposing question → grounded search → the answering fact + source
   ├─ Reconcile   Evidence labeled by side → verdict model finds the factual middle ground
   ├─ Self-review Audit the verdict vs the evidence; only soften overreach (absence ≠ contradiction)
   └─ Learn       Claim + verdict embedded & stored → similar claims answer instantly next time
```

**Tech stack:** Next.js 15 (App Router) · TypeScript · Tailwind · Firestore · Google Cloud Run ·
Gemini 2.5 Flash (Vertex + Developer API) · Groq Whisper · xAI Grok · Tavily / Jina search · yt-dlp.

---

## Run it locally

### 1. Prerequisites
- **Node 20+**
- **ffmpeg** and **yt-dlp** on your PATH (captions + audio):
  ```bash
  # macOS
  brew install ffmpeg yt-dlp
  # Debian/Ubuntu
  sudo apt-get install -y ffmpeg && pipx install yt-dlp
  ```
- A **Google Cloud project** with Firestore enabled (for sessions, cache, knowledge base).

### 2. Clone + install
```bash
git clone https://github.com/<you>/counterpoints.git
cd counterpoints
npm install
```

### 3. Environment
```bash
cp .env.example .env.local
```
Fill in `.env.local`. **Minimum to boot:** `GOOGLE_AI_API_KEY`, `GROQ_API_KEY`, `TAVILY_API_KEY`,
`XAI_API_KEY`, `YOUTUBE_API_KEY`, `GCLOUD_PROJECT`. Each key has a "where to get it" link in
`.env.example`. The Jina key, extra Tavily keys, proxy, and cookies are optional but improve
reliability.

### 4. Google Cloud auth (for Firestore + Vertex, no key needed)
```bash
gcloud auth application-default login
gcloud config set project <your-project-id>
```

### 5. Start
```bash
npm run dev        # http://localhost:3030
```

---

## YouTube captions: cookies & proxy (important)

YouTube blocks caption requests from **datacenter IPs** and sometimes requires a logged-in session.
The app fetches captions through a chain — **InnerTube → yt-dlp → AI transcription** — and two
optional pieces make it far more reliable:

### A) YouTube cookies (helps yt-dlp fetch captions)
Export your browser's YouTube cookies to a **Netscape `cookies.txt`** and point `YTDLP_COOKIES` at it.

1. Install a cookies exporter extension, e.g. **"Get cookies.txt LOCALLY"** (Chrome/Brave/Firefox).
2. Log in to `youtube.com`, click the extension, **Export** → save as `www.youtube.com_cookies.txt`
   in the project root.
3. In `.env.local`:
   ```
   YTDLP_COOKIES=./www.youtube.com_cookies.txt
   ```
> ⚠️ This file is a login secret — it is **gitignored** and must never be committed. Cookies expire;
> re-export every few weeks if captions start failing.

### B) Residential proxy (defeats the datacenter-IP block)
On a server (Cloud Run, etc.) YouTube blocks the datacenter IP. Route yt-dlp through a **residential
proxy** so requests look like home traffic:
```
PROXY_URL=http://USER:PASS@host:port
```
Any residential proxy works (e.g. **Webshare → Rotating Residential**, ~$3.50/mo). Without it,
caption-less videos still work via the slower AI-transcription fallback.

### C) Live audio capture (no cookies/proxy needed)
For live shows, click **📺 Capture Video Audio** (or **🎙 Mic**) — the browser captures tab/mic
audio, sends it to the server, and transcribes it via **Whisper (Groq)**, with a Gemini fallback.
See the in-app **"Setup guide"** for the per-browser screen-share steps (Chrome "Chrome Tab" +
"share tab audio"; Brave "Window" + "share system audio").

---

## Deploy (Google Cloud Run)

Secrets are stored in **Google Secret Manager** and mounted at deploy time — they are never in the
image or the repo. `deploy.sh` wires them up.

```bash
# 1) One-time: enable the required APIs on a fresh project
gcloud services enable run.googleapis.com aiplatform.googleapis.com \
  firestore.googleapis.com secretmanager.googleapis.com \
  youtube.googleapis.com cloudbuild.googleapis.com

# 2) Deploy the required Firestore composite indexes (history + caches need these,
#    or queries fail with FAILED_PRECONDITION). Uses firestore.indexes.json in this repo:
firebase deploy --only firestore:indexes      # (or create them via gcloud firestore indexes composite create)

# 3) Create the secrets (names must match deploy.sh)
printf '%s' "$YOUR_KEY" | gcloud secrets create gemini-key --data-file=-
#   …repeat for: yt-api-key, xai-api-key, jina-api-key, tavily-key[-2/-3],
#   groq-key, yt-cookies (optional), proxy-url (optional)

# 4) Deploy (deploy.sh auto-grants the IAM roles: Vertex user, datastore.user,
#    storage.objectAdmin, secret accessor)
./deploy.sh        # builds + deploys to Cloud Run (min-instances 0 → scales to zero)
```

`.gcloudignore` keeps secrets, `node_modules`, and build output out of the upload; `.dockerignore`
keeps the image lean.

---

## Cost

Roughly **$0.05–0.09 per fresh fact-check, ~$0 cached**, with a **~$3.50/mo fixed floor** (the proxy);
everything else scales to zero at idle. Full line-by-line breakdown, the per-claim call math, and a
paste-ready prompt to re-price it against live provider pricing are in **[`COST_AUDIT.md`](./COST_AUDIT.md)**
and on the **[/costs](https://counterpoints-app-zdku5kri5a-uc.a.run.app/costs)** page.

---

## Security notes

- **No secrets in the repo.** All keys come from `.env.local` (local) or Secret Manager (prod).
- `.env.local`, `*cookies.txt`, `*.key`, and service-account JSON are **gitignored**.
- The deployed Cloud Run instance, GCP project, and Secret Manager are private.
- If you fork this, rotate any key you ever paste anywhere, and never commit `.env.local`.

---

## License

MIT — see [`LICENSE`](./LICENSE).
