'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TranscriptPanel }    from '@/components/TranscriptPanel'
import { EvidenceCard }       from '@/components/EvidenceCard'
import { PantsOnFire }        from '@/components/PantsOnFire'
import Image from 'next/image'
import Link  from 'next/link'
import { AlertFlash }         from '@/components/AlertFlash'
import { PredictiveBanner }   from '@/components/PredictiveBanner'
import { PermissionsGuide }   from '@/components/PermissionsGuide'
import { LoginModal }         from '@/components/LoginModal'
import { SettingsPanel }      from '@/components/SettingsPanel'
import { LogIn, LogOut, User, History as HistoryIcon, Radio, Settings as SettingsIcon, Mic, MonitorPlay, Square, ChevronDown, HelpCircle } from 'lucide-react'
import { SourcesPanel }       from '@/components/SourcesPanel'
import { VideoPlayer }        from '@/components/VideoPlayer'
import { VerifyTooltip }      from '@/components/VerifyTooltip'
import { useTranscript }      from '@/hooks/useTranscript'
import { useAudioCapture }    from '@/hooks/useAudioCapture'
import { useFrameCapture }    from '@/hooks/useFrameCapture'
import { useYouTubeSync }     from '@/hooks/useYouTubeSync'
import { extractVideoId }     from '@/lib/youtube-transcript'
import type { XPostData }     from '@/app/api/x-post/route'
import { XPostEmbed }         from '@/components/XPostEmbed'
import type { CounterpointCard, LLMSettings, TopicCategory, TranscriptLine, Verdict } from '@/types'

const PLAYER_ID = 'yt-player'

// lucide-react dropped its brand icons, so use an inline GitHub mark for the footer link
function GithubMark({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

// Match a tab-audio transcript chunk against the pre-loaded CC transcript.
// Returns the CC offsetMs if overlap is strong enough, otherwise null.
function matchToCCTranscript(
  transcribed: string,
  cc: Array<{ text: string; offsetMs: number }>,
  hintMs: number
): number | null {
  if (cc.length < 3) return null
  const clean = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '')
  const words = clean(transcribed).split(/\s+/).filter(w => w.length > 2)
  if (words.length < 4) return null
  const wordSet = new Set(words)
  // Search ±45s around hintMs first, fall back to full transcript
  const lo = hintMs - 45_000, hi = hintMs + 10_000
  const pool = cc.filter(l => l.offsetMs >= lo && l.offsetMs <= hi)
  const search = pool.length >= 3 ? pool : cc
  let bestScore = 0, bestMs: number | null = null
  for (let i = 0; i < search.length; i++) {
    const windowWords = search.slice(i, i + 5).map(l => clean(l.text)).join(' ')
      .split(/\s+/).filter(w => w.length > 2)
    const overlap = windowWords.filter(w => wordSet.has(w)).length
    const score = overlap / Math.max(words.length, windowWords.length, 1)
    if (score > bestScore && score > 0.3) { bestScore = score; bestMs = search[i].offsetMs }
  }
  return bestMs
}

function isXUrl(url: string) {
  return /(?:twitter|x)\.com\/[^/]+\/status(?:es)?\/\d+/.test(url)
}

type TranscriptStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'live' | 'ai-loading'

// Group raw YouTube caption entries into ~9-second chunks so the transcript panel
// shows readable paragraphs instead of one-word flashes.
function chunkTranscriptEntries(
  entries: import('@/lib/youtube-transcript').TranscriptEntry[],
  windowMs = 9_000
): import('@/lib/youtube-transcript').TranscriptEntry[] {
  const chunks: import('@/lib/youtube-transcript').TranscriptEntry[] = []
  let group: typeof entries = []
  for (const entry of entries) {
    group.push(entry)
    const span = entry.offsetMs + (entry.durationMs || 0) - group[0].offsetMs
    if (span >= windowMs) {
      chunks.push({
        text: group.map(e => e.text).join(' '),
        offsetMs: group[0].offsetMs,
        durationMs: span,
      })
      group = []
    }
  }
  if (group.length > 0) {
    const last = group[group.length - 1]
    chunks.push({
      text: group.map(e => e.text).join(' '),
      offsetMs: group[0].offsetMs,
      durationMs: last.offsetMs + (last.durationMs || 0) - group[0].offsetMs,
    })
  }
  return chunks
}

// Word-overlap score: how many significant words from the claim appear in a transcript line
function wordOverlap(claimText: string, lineText: string): number {
  const claimWords = new Set(claimText.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  return lineText.toLowerCase().split(/\s+/).filter(w => claimWords.has(w)).length
}

// True if `text` is the same as (or a near-rephrasing of) any already-checked claim
function isDuplicateClaim(text: string, recent: string[]): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim()
  const t = norm(text)
  const tWords = new Set(t.split(/\s+/).filter(w => w.length > 3))
  return recent.some(r => {
    const rn = norm(r)
    if (rn === t) return true
    const rWords = rn.split(/\s+/).filter(w => w.length > 3)
    if (!rWords.length) return false
    const overlap = rWords.filter(w => tWords.has(w)).length / rWords.length
    return overlap > 0.8  // >80% of significant words shared → treat as the same claim
  })
}

export default function Home() {
  const [urlInput,           setUrlInput]           = useState('')
  const [pendingAutoLoad,    setPendingAutoLoad]    = useState<string | null>(null)
  const [videoId,            setVideoId]            = useState<string | null>(null)
  const [xPost,              setXPost]              = useState<XPostData | null>(null)
  const [videoTitle,         setVideoTitle]         = useState<string | null>(null)
  const [fullTranscript,     setFullTranscript]     = useState<import('@/lib/youtube-transcript').TranscriptEntry[]>([])
  const [transcriptStatus,   setTranscriptStatus]   = useState<TranscriptStatus>('idle')
  const [cards,              setCards]              = useState<CounterpointCard[]>([])
  const [lieScore,           setLieScore]           = useState(0)
  const [verdictCounts,      setVerdictCounts]      = useState({ true: 0, misleading: 0, false: 0 })
  const [latestVerdict,      setLatestVerdict]      = useState<{ verdict: Verdict; claim: string } | null>(null)
  const [predictiveTopic,    setPredictiveTopic]    = useState<string | null>(null)
  const [showSettings,       setShowSettings]       = useState(false)
  const [showSources,        setShowSources]        = useState(false)
  const [isLive,             setIsLive]             = useState(false)
  const [isYoutubeLive,      setIsYoutubeLive]      = useState(false)
  const [isAnalyzing,        setIsAnalyzing]        = useState(false)
  const [checkingClaim,      setCheckingClaim]      = useState<string | null>(null)
  const [settings,           setSettings]           = useState<LLMSettings>({ provider: 'gemini' })
  // Bidirectional linking state
  const [claimVerdicts,      setClaimVerdicts]      = useState<Map<string, Verdict>>(new Map())
  const [activeClaimId,      setActiveClaimId]      = useState<string | null>(null)
  // When true, all YT CC lines were preloaded — useYouTubeSync skips incremental sync
  const [ytLinesPreloaded,   setYtLinesPreloaded]   = useState(false)
  // Increment to force-scroll transcript to current line
  const [scrollTrigger,      setScrollTrigger]      = useState(0)
  const hasScrolledToNowRef = useRef(false)
  // Toast shown when screen-share dialog is declined
  const [captureError,       setCaptureError]       = useState<string | null>(null)
  // Transcript source tab — 'live' is the default/primary (real-time capture); 'cc' = loaded captions
  const [transcriptTab,      setTranscriptTab]      = useState<'cc' | 'live'>('live')
  const transcriptTabRef = useRef<'cc' | 'live'>('live')
  useEffect(() => { transcriptTabRef.current = transcriptTab }, [transcriptTab])
  // Compare/contrast agent note — set when CC and live transcripts of the same content diverge
  const [reconcileNote,      setReconcileNote]      = useState<string | null>(null)
  // Session persistence + user identity
  const [sessionId,          setSessionId]          = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])
  const [sessionRestoreBanner, setSessionRestoreBanner] = useState<{ sessionId: string; cardCount: number; transcriptCount: number } | null>(null)
  const [userId,             setUserId]             = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  useEffect(() => { userIdRef.current = userId }, [userId])
  const [userEmail,          setUserEmail]          = useState<string | null>(null)
  const [showLoginModal,     setShowLoginModal]     = useState(false)
  const [showUserMenu,       setShowUserMenu]       = useState(false)
  // Mobile tab switcher — one flat 3-tab bar: transcript | your checks | auto feed
  const [mobileTab,          setMobileTab]          = useState<'transcript' | 'main' | 'auto'>('transcript')
  // True at md+ — gates the desktop drag-split inline style so mobile panes fill height instead
  const [isDesktop,          setIsDesktop]          = useState(false)
  // Resizable / expandable panels
  const [splitRatio,         setSplitRatio]         = useState(0.5)
  const [expandedPanel,      setExpandedPanel]      = useState<'transcript' | 'checks' | null>(null)
  // Right pane: 'main' = your manual checks + the single latest auto-check; 'auto' = the full auto feed
  const [rightTab,           setRightTab]           = useState<'main' | 'auto'>('main')
  // Permissions guide modal
  const [showPermissionsGuide, setShowPermissionsGuide] = useState(false)

  const videoRef             = useRef<HTMLVideoElement>(null)
  const transcriptAreaRef    = useRef<HTMLDivElement>(null)
  const fullTranscriptRef    = useRef<import('@/lib/youtube-transcript').TranscriptEntry[]>([])
  const processingRef     = useRef(false)
  const rollingTextRef    = useRef('')
  const linesRef          = useRef<TranscriptLine[]>([])
  // Track playback position + last-analyzed watermark so we only fact-check what's actually been played
  const currentMsRef      = useRef(0)
  const lastAnalyzedMsRef = useRef(-1)   // CC timeline (video position)
  const lastAnalyzedLiveRef = useRef(-1) // live timeline (capture-elapsed)
  const prevSecRef        = useRef(0)
  // Wall-clock start of a live capture session — anchors tab-audio chunk timestamps when no video is loaded
  const captureStartRef   = useRef(0)
  // Incremented on every new video load — in-flight processClaim calls check this before adding cards
  const videoVersionRef   = useRef(0)
  // Memory for the claim gatekeeper — recently-checked claim texts, to avoid re-flagging duplicates
  const recentClaimsRef   = useRef<string[]>([])
  const cardsRef          = useRef<CounterpointCard[]>([])  // live mirror of `cards` for synchronous dedup in processClaim

  const transcript = useTranscript()
  const { capture: captureFrame } = useFrameCapture(videoRef)

  // Keep refs in sync — just ref updates, no deps chain
  useEffect(() => {
    rollingTextRef.current = transcript.getRollingText()
    linesRef.current = transcript.lines
  })

  useEffect(() => { fullTranscriptRef.current = fullTranscript }, [fullTranscript])

  useEffect(() => {
    const saved = localStorage.getItem('cp_settings')
    if (saved) setSettings(JSON.parse(saved))
    // Auto-load from query param (e.g. clicking a history item).
    // Prefer the clean ?v=<videoId>; fall back to legacy ?url=.
    const params = new URLSearchParams(window.location.search)
    const v = params.get('v')
    const autoUrl = v ? `https://www.youtube.com/watch?v=${v}` : params.get('url')
    if (autoUrl) {
      setUrlInput(autoUrl)
      setPendingAutoLoad(autoUrl)   // a one-shot effect (below) triggers the actual load + restore
    }
  }, [])

  // Initialize userId; prompt anonymous users to log in (modal) once per session
  useEffect(() => {
    const stored = localStorage.getItem('cp_user_id')
    const savedEmail = localStorage.getItem('cp_user_email')
    if (savedEmail) setUserEmail(savedEmail)
    if (stored && !stored.startsWith('anon_')) {
      setUserId(stored)  // email-derived — already logged in
    } else if (stored) {
      setUserId(stored)  // anon — prompt to log in
      setShowLoginModal(true)
    } else {
      const anonId = 'anon_' + Math.random().toString(36).slice(2)
      localStorage.setItem('cp_user_id', anonId)
      setUserId(anonId)
      setShowLoginModal(true)
    }
  }, [])

  // Called by LoginModal after a successful login
  const handleLoggedIn = (email: string) => {
    setUserId(localStorage.getItem('cp_user_id'))
    setUserEmail(email)
  }

  // Switch email → log out and immediately re-open the login prompt
  const handleSwitchEmail = () => {
    setShowUserMenu(false)
    localStorage.removeItem('cp_user_email')
    setUserEmail(null)
    setShowLoginModal(true)
  }

  // Log out → become anonymous (history retrievable later by logging in again)
  const handleLogout = () => {
    setShowUserMenu(false)
    localStorage.removeItem('cp_user_email')
    const anonId = 'anon_' + Math.random().toString(36).slice(2)
    localStorage.setItem('cp_user_id', anonId)
    setUserId(anonId)
    setUserEmail(null)
  }

  // Esc exits expanded panel
  useEffect(() => {
    if (!expandedPanel) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpandedPanel(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [expandedPanel])

  // Track desktop breakpoint so the drag-split style applies only at md+ (mobile panes fill height)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const handleAudioChunk = useCallback(async (blob: Blob) => {
    // Anchor: if a video is loaded in the embedded player use its time; otherwise wall-clock
    // elapsed since capture began (snapshot before the async fetch).
    const videoMs   = currentMsRef.current
    const elapsedMs = captureStartRef.current ? Date.now() - captureStartRef.current : 0
    const fd = new FormData()
    fd.append('audio', blob)
    const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
    const { text, segments } = await res.json() as {
      text: string; segments?: { startMs: number; endMs: number; text: string }[]
    }

    if (segments && segments.length) {
      // Place the chunk so its end lands ~now; each segment keeps its accurate intra-chunk offset.
      const span = segments[segments.length - 1].endMs
      const base = Math.max(0, (videoMs > 0 ? videoMs : elapsedMs) - span)
      for (const s of segments) {
        if (!s.text?.trim()) continue
        const off = base + s.startMs
        const cc  = videoMs > 0 ? matchToCCTranscript(s.text, fullTranscriptRef.current, off) : null
        transcript.append(s.text, cc ?? off, 'live')
      }
    } else if (text?.trim()) {
      const off = videoMs > 0 ? videoMs : elapsedMs
      const cc  = matchToCCTranscript(text, fullTranscriptRef.current, off)
      transcript.append(text, cc ?? off, 'live')
    }
  }, [transcript])

  const audioCapture = useAudioCapture({
    onTranscript: (text) => transcript.append(text, currentMsRef.current, 'live'),
    onChunk: handleAudioChunk,
    onError: msg => { setCaptureError(msg); setTimeout(() => setCaptureError(null), 7000) },
  })

  const processClaim = useCallback(async (
    claimText: string,
    claimId: string,
    topic: string,
    transcriptOffsetMs: number = 0,
    opts: { noCache?: boolean; category?: TopicCategory; origin?: 'auto' | 'manual' } = {},
  ) => {
    const myVersion = videoVersionRef.current
    const category = opts.category ?? 'general'
    setCheckingClaim(claimText)

    // Resolve to an existing card: same id, OR a re-detection of the same claim (fresh id, same
    // text). Reusing the existing id means a re-check UPDATES one card instead of appending a
    // duplicate and shoving older (restored) cards out. "No duplicates, but you can add."
    const existingCard = cardsRef.current.find(c => c.id === claimId || isDuplicateClaim(claimText, [c.claim]))
    const cardId = existingCard?.id ?? claimId
    // Manual wins: a sentence the user explicitly checked is 'manual' even if auto found it first.
    // Auto re-checking an existing manual card never demotes it back to 'auto'.
    const origin: 'auto' | 'manual' =
      opts.origin === 'manual' || existingCard?.origin === 'manual' ? 'manual' : (opts.origin ?? 'auto')
    const emptySpectrum = () => ({ left: [], center: [], right: [], alt: [], grok: [], establishment: [] })

    const frame = captureFrame()
    let visionSnapshot = null
    if (frame) {
      const vr = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: frame }),
      })
      visionSnapshot = await vr.json()
    }

    // Show a "checking" state. Existing card → update it in place; otherwise prepend a fresh
    // placeholder. Never truncate the list — restored + finished cards must never be erased.
    setCards(prev => {
      if (prev.some(c => c.id === cardId)) {
        // Promote origin immediately (manual wins) so a manual re-check jumps to the Main tab now.
        return prev.map(c => c.id === cardId
          ? { ...c, origin, verdictSummary: opts.noCache ? 'Re-checking sources…' : 'Checking…', spectrum: emptySpectrum() }
          : c)
      }
      const placeholder: CounterpointCard = {
        id: cardId, claimId: cardId, claim: claimText,
        verdict: 'UNVERIFIED', verdictSummary: 'Checking…', category, origin,
        spectrum: emptySpectrum(),
        createdAt: Date.now(), transcriptOffsetMs, visionSnapshot, voiceSnapshot: null,
      }
      return [placeholder, ...prev]
    })

    const evRes = await fetch('/api/evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim: claimText, topic, category, claimId: cardId, settings, noCache: opts.noCache === true }),
    })

    if (evRes.status === 429) {
      setCards(prev => prev.map(c => c.id === cardId ? {
        ...c,
        verdictSummary: '⚠️ Rate limit reached — add your own API key in ⚙ Settings to continue checking claims without limits.',
      } : c))
      setCheckingClaim(null)
      return
    }

    const finishCard = (card: CounterpointCard) => {
      if (videoVersionRef.current !== myVersion) return
      setCheckingClaim(null)
      setCards(prev => prev.map(c => {
        if (c.id !== cardId) return c
        // Merge: keep already-streamed lens items if the final card's lens came back empty.
        const keys = ['left', 'center', 'right', 'alt', 'grok', 'establishment'] as const
        const mergedSpectrum = { ...card.spectrum }
        for (const k of keys) {
          if (!(mergedSpectrum[k]?.length) && c.spectrum[k]?.length) mergedSpectrum[k] = c.spectrum[k]
        }
        // Manual wins even across a race: if a concurrent manual check already promoted this card,
        // a late-finishing auto check must not demote it back to the Auto feed.
        return { ...card, id: cardId, claimId: cardId, origin: c.origin === 'manual' ? 'manual' : origin, spectrum: mergedSpectrum }
      }))
      setLatestVerdict({ verdict: card.verdict, claim: card.claim })
      setClaimVerdicts(prev => new Map(prev).set(card.claimId, card.verdict))
      // Persist card to session
      if (sessionIdRef.current) {
        fetch('/api/sessions/card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionIdRef.current, card }),
        }).catch(() => { /* best-effort */ })
      }
      setLieScore(prev => {
        const delta = card.verdict === 'FALSE' ? 30 : card.verdict === 'MISLEADING' ? 15 : card.verdict === 'TRUE' ? -5 : 0
        return Math.max(0, Math.min(100, prev + delta))
      })
      setVerdictCounts(prev => ({
        true:       prev.true       + (card.verdict === 'TRUE'       ? 1 : 0),
        misleading: prev.misleading + (card.verdict === 'MISLEADING' ? 1 : 0),
        false:      prev.false      + (card.verdict === 'FALSE'       ? 1 : 0),
      }))
    }

    if (!evRes.body) {
      setCheckingClaim(null)
      return
    }

    const reader = evRes.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const chunk = JSON.parse(line) as {
              type: string; key?: string; items?: import('@/types').SpectrumItem[]; card?: CounterpointCard
            }
            if (videoVersionRef.current !== myVersion) { reader.cancel(); return }
            if (chunk.type === 'lens' && chunk.key) {
              setCards(prev => prev.map(c =>
                c.id === cardId
                  // Don't let a late empty update wipe a lens that already has items (prevents flicker).
                  ? { ...c, spectrum: { ...c.spectrum, [chunk.key!]: (chunk.items?.length ? chunk.items : c.spectrum[chunk.key as keyof typeof c.spectrum] ?? []) } }
                  : c
              ))
            }
            if (chunk.type === 'done' && chunk.card) {
              finishCard({ ...chunk.card, visionSnapshot, voiceSnapshot: null, transcriptOffsetMs })
            }
          } catch { /* ignore malformed chunk */ }
        }
      }
    } catch {
      setCheckingClaim(null)
    }
  }, [captureFrame, settings])

  const analyzeNow = useCallback(async () => {
    if (processingRef.current) return

    // Analyze only the ACTIVE tab's source (CC vs live have separate timelines)
    const tab = transcriptTabRef.current
    const wmRef = tab === 'cc' ? lastAnalyzedMsRef : lastAnalyzedLiveRef  // separate timelines
    const sourceLines = linesRef.current.filter(l => (l.source ?? 'live') === tab)
    const upToMs = tab === 'cc' ? currentMsRef.current : 0  // live: no seek timeline → analyze all new
    const watermarkMs = wmRef.current

    const pendingLines = sourceLines.filter(l => {
      const ms = l.offsetMs ?? 0
      return ms > watermarkMs && (upToMs <= 0 || ms <= upToMs)
    })

    const text = pendingLines.map(l => l.text).join(' ')
    if (text.trim().length < 60) return

    // Advance watermark before async work to prevent duplicate analysis on next tick
    wmRef.current = upToMs > 0 ? upToMs : (sourceLines.at(-1)?.offsetMs ?? watermarkMs)

    processingRef.current = true
    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, settings, recentClaims: recentClaimsRef.current.slice(-20) }),
      })
      const { claims } = await res.json() as { claims: import('@/types').Claim[] }

      // Drop near-duplicates of already-checked claims (memory) so research fires once per claim
      const fresh = claims.filter(c => !isDuplicateClaim(c.text, recentClaimsRef.current))

      // Add all claims to memory before parallel async work
      for (const claim of fresh) {
        recentClaimsRef.current = [...recentClaimsRef.current, claim.text].slice(-30)
      }
      const claimLines = linesRef.current.filter(l => (l.source ?? 'live') === tab)

      const checkOne = async (claim: import('@/types').Claim) => {
        let bestLine: TranscriptLine | undefined
        let bestScore = 0
        for (const line of claimLines) {
          const score = wordOverlap(claim.text, line.text)
          if (score > bestScore) { bestScore = score; bestLine = line }
        }
        if (!bestLine) bestLine = claimLines.at(-1)
        if (bestLine) transcript.markClaim(bestLine.id, claim.id)
        await processClaim(claim.text, claim.id, claim.topic, bestLine?.offsetMs ?? 0, { category: claim.category, origin: 'auto' })
      }

      // FIRST claim alone (no contention → fastest first verdict), THEN the rest 3-at-a-time.
      // Avoids 15 claims choking the rate-limited backend and all finishing together ~30s later.
      const myVer = videoVersionRef.current
      if (fresh.length > 0 && videoVersionRef.current === myVer) {
        await checkOne(fresh[0])
      }
      const rest = fresh.slice(1)
      let nextIdx = 0
      const worker = async () => {
        while (nextIdx < rest.length && videoVersionRef.current === myVer) {
          await checkOne(rest[nextIdx++])
        }
      }
      await Promise.all(Array.from({ length: Math.min(3, rest.length) }, worker))
    } finally {
      processingRef.current = false
      setIsAnalyzing(false)
    }
  }, [settings, processClaim, transcript.markClaim])

  // Compare/contrast agent — when BOTH CC and live transcripts have content, periodically reconcile them
  useEffect(() => {
    const timer = setInterval(async () => {
      const lines = linesRef.current
      const ccLines   = lines.filter(l => (l.source ?? 'live') === 'cc')
      const liveLines = lines.filter(l => (l.source ?? 'live') === 'live')
      if (ccLines.length < 3 || liveLines.length < 3) return  // only when both sources are active
      try {
        const res = await fetch('/api/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ccText:   ccLines.slice(-15).map(l => l.text).join(' '),
            liveText: liveLines.slice(-15).map(l => l.text).join(' '),
            settings,
          }),
        })
        const d = await res.json() as { divergence?: boolean; notes?: string[] }
        setReconcileNote(d.divergence && d.notes?.length ? d.notes.join(' · ') : null)
      } catch { /* silent */ }
    }, 25_000)
    return () => clearInterval(timer)
  }, [settings])

  // Periodic analysis — 3s for live, 5s for preloaded (analyzeNow has watermark guard so safe to tick often)
  useEffect(() => {
    if (!isLive && fullTranscript.length === 0) return
    const ms = (isLive || isYoutubeLive) ? 3_000 : 5_000
    const timer = setInterval(analyzeNow, ms)
    return () => clearInterval(timer)
  }, [isLive, isYoutubeLive, fullTranscript.length, analyzeNow])

  // Live YouTube CC re-poll: re-fetch captions every 20s to get new lines from the live stream
  useEffect(() => {
    if (!isYoutubeLive || !videoId) return
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/youtube?id=${videoId}`)
        const data = await res.json() as { transcript: import('@/lib/youtube-transcript').TranscriptEntry[] }
        const newEntries = data.transcript ?? []
        if (newEntries.length > 0) {
          setFullTranscript(prev => {
            const existingMs = new Set(prev.map(e => e.offsetMs))
            const added = newEntries.filter(e => !existingMs.has(e.offsetMs))
            return added.length > 0 ? [...prev, ...added] : prev
          })
        }
      } catch { /* silent */ }
    }, 20_000)
    return () => clearInterval(poll)
  }, [isYoutubeLive, videoId])

  const predictDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlePredictTopic = useCallback((upcomingText: string) => {
    if (predictDebounceRef.current) clearTimeout(predictDebounceRef.current)
    predictDebounceRef.current = setTimeout(async () => {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: upcomingText, settings }),
      })
      const { claims } = await res.json() as { claims: import('@/types').Claim[] }
      if (claims.length > 0) {
        setPredictiveTopic(claims[0].topic)
        setTimeout(() => setPredictiveTopic(null), 8000)
      }
    }, 3000)
  }, [settings])

  const { currentSec, seekTo } = useYouTubeSync(
    PLAYER_ID,
    videoId,
    fullTranscript,
    (text, offsetMs) => transcript.append(text, offsetMs, 'cc'),
    handlePredictTopic,
    !ytLinesPreloaded,  // skip line sync when all lines are already preloaded
  )

  // Keep currentMsRef in sync with video playback position
  useEffect(() => {
    currentMsRef.current = Math.round(currentSec * 1000)
  }, [currentSec])

  // One-time auto-scroll to current line when video starts playing after a preload
  useEffect(() => {
    if (currentSec > 0 && ytLinesPreloaded && !hasScrolledToNowRef.current) {
      hasScrolledToNowRef.current = true
      setScrollTrigger(n => n + 1)
    }
  }, [currentSec, ytLinesPreloaded])

  // NOTE: periodic auto-scroll removed — it yanked the user back every 5s. The transcript
  // now only scrolls on explicit actions (▶ Now button, seeking, clicking a card/timestamp).

  // Seek detection: when currentSec jumps >2.5s (not normal ~1s playback), scroll transcript
  // to the new position and reset the analyze watermark so nearby lines get fact-checked
  useEffect(() => {
    if (currentSec <= 0) return
    const prev = prevSecRef.current
    const delta = currentSec - prev
    prevSecRef.current = currentSec
    if (delta > 2.5 || delta < -0.5) {
      setScrollTrigger(n => n + 1)  // jump the transcript to the seeked position
      lastAnalyzedMsRef.current = Math.max(-1, (currentSec - 5) * 1000)
      // Only trim the rolling LIVE window. Preloaded CC must keep all lines so the user
      // can scroll/seek both directions freely.
      if (!ytLinesPreloaded) {
        transcript.trimBefore(Math.max(0, (currentSec - 30) * 1000))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSec, ytLinesPreloaded])

  // Persist ALL cards to the session whenever they change (debounced). This saves fact-checks
  // immediately and keeps them current as sources are added/re-researched — never static.
  // Also mirror `cards` into cardsRef synchronously so processClaim can dedup against the live set.
  useEffect(() => {
    cardsRef.current = cards
    if (!sessionIdRef.current || cards.length === 0) return
    const t = setTimeout(() => {
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          cards: cards.map(c => ({ ...c, visionSnapshot: null, voiceSnapshot: null })),
        }),
      }).catch(() => { /* best-effort */ })
    }, 1500)
    return () => clearTimeout(t)
  }, [cards])

  // Transcript claim clicked → seek video + highlight matching card
  const handleClaimClick = useCallback((claimId: string, offsetMs: number) => {
    if (!claimId) return
    setActiveClaimId(claimId)
    seekTo(offsetMs / 1000)
    setTimeout(() => {
      document.getElementById(`card-${claimId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
  }, [seekTo])

  // Any transcript line manually sent to fact-checker — runs independently of auto-analysis.
  // Tagged 'manual' so it surfaces on the Main tab; jump there so the new card is visible at once.
  const handleManualCheck = useCallback(async (text: string, offsetMs: number) => {
    if (!text.trim()) return
    setRightTab('main')
    setMobileTab('main')                                    // mobile: reveal the Your Checks pane
    setExpandedPanel(p => (p === 'transcript' ? null : p))  // desktop: un-expand transcript so the check is visible
    const claimId = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const line = linesRef.current.find(l => l.text.trim() === text.trim())
    if (line) transcript.markClaim(line.id, claimId)
    await processClaim(text, claimId, 'general', offsetMs, { origin: 'manual' })
  }, [processClaim, transcript])

  // Evidence card timestamp clicked → seek video
  const handleCardSeek = useCallback((offsetMs: number) => {
    seekTo(offsetMs / 1000)
  }, [seekTo])

  // Apply a saved session's transcript + fact-checks to the UI (used by history click + banner)
  const restoreSessionData = useCallback((session: import('@/types').CpSession) => {
    if ((session.transcript?.length ?? 0) > 0) {
      setFullTranscript(session.transcript)
      setTranscriptStatus('ready')
      setYtLinesPreloaded(true)
      transcript.appendAll(session.transcript)
      setTranscriptTab('cc')
    }
    if ((session.cards?.length ?? 0) > 0) {
      setCards(session.cards)
      // Tell the dedup memory about restored claims so the analyze loop never re-checks them
      // (which would create duplicates and shove the originals out). This is the key fix.
      recentClaimsRef.current = [
        ...recentClaimsRef.current,
        ...session.cards.map(c => c.claim),
      ].slice(-60)
      const vc = { true: 0, misleading: 0, false: 0 }
      let score = 0
      const vm = new Map<string, import('@/types').Verdict>()
      for (const c of session.cards) {
        if (c.verdict === 'TRUE')       { vc.true++;       score = Math.max(0, score - 5) }
        if (c.verdict === 'MISLEADING') { vc.misleading++; score = Math.min(100, score + 15) }
        if (c.verdict === 'FALSE')      { vc.false++;      score = Math.min(100, score + 30) }
        vm.set(c.claimId, c.verdict)
      }
      setVerdictCounts(vc)
      setLieScore(score)
      setClaimVerdicts(vm)
    }
    setSessionRestoreBanner(null)
  }, [transcript])

  // Archive/dismiss a fact-check card — removes it from view and remembers the claim so it
  // isn't re-detected. The debounced cards-save then persists the reduced set.
  const handleArchiveCard = useCallback((cardId: string) => {
    setCards(prev => {
      const card = prev.find(c => c.id === cardId)
      if (card) recentClaimsRef.current = [...recentClaimsRef.current, card.claim].slice(-40)
      return prev.filter(c => c.id !== cardId)
    })
  }, [])

  // Re-run sources for a card — forces a fresh search (bypasses the knowledge-base cache)
  const handleRerunSources = useCallback((card: CounterpointCard) => {
    processClaim(card.claim, card.id, 'general', card.transcriptOffsetMs ?? 0, { noCache: true, category: card.category })
  }, [processClaim])

  // Evidence card header clicked → seek video + jump to matching transcript line
  const handleCardActivate = useCallback((claimId: string, offsetMs: number) => {
    const line = linesRef.current.find(l => l.claimId === claimId)
    if (line) setTranscriptTab(line.source === 'cc' ? 'cc' : 'live')
    setActiveClaimId(claimId)
    if (offsetMs > 0) seekTo(offsetMs / 1000)
  }, [seekTo])

  const handleLoadX = async () => {
    transcript.reset()
    setCards([])
    setLieScore(0)
    setVerdictCounts({ true: 0, misleading: 0, false: 0 })
    setTranscriptStatus('loading')
    setVideoId(null)
    setXPost(null)
    setVideoTitle(null)
    setClaimVerdicts(new Map())
    setActiveClaimId(null)
    setIsYoutubeLive(false)
    setCheckingClaim(null)
    currentMsRef.current = 0
    lastAnalyzedMsRef.current = -1
    videoVersionRef.current++

    try {
      const res = await fetch(`/api/x-post?url=${encodeURIComponent(urlInput)}`)
      const data = await res.json() as XPostData
      if (data.text) {
        setXPost(data)
        setVideoTitle(`@${data.authorHandle}: ${data.text.slice(0, 60)}…`)
        transcript.append(data.text, 0)
        setTranscriptStatus('ready')
        setTimeout(() => analyzeNow(), 500)
      } else {
        setTranscriptStatus('empty')
      }
    } catch {
      setTranscriptStatus('empty')
    }
  }

  const handleLoadUrl = async (urlArg?: string, opts?: { autoRestore?: boolean }) => {
    const url = urlArg ?? urlInput
    if (isXUrl(url)) { await handleLoadX(); return }
    const id = extractVideoId(url)
    if (!id) return

    setVideoId(id)
    setXPost(null)
    transcript.reset()
    setCards([])
    setLieScore(0)
    setVerdictCounts({ true: 0, misleading: 0, false: 0 })
    setTranscriptStatus('loading')
    setFullTranscript([])
    setVideoTitle(null)
    setClaimVerdicts(new Map())
    setActiveClaimId(null)
    setIsYoutubeLive(false)
    setCheckingClaim(null)
    setYtLinesPreloaded(false)
    setSessionRestoreBanner(null)
    hasScrolledToNowRef.current = false
    prevSecRef.current = 0
    currentMsRef.current = 0
    lastAnalyzedMsRef.current = -1
    videoVersionRef.current++

    // Check session cache for this video + user
    const cacheCheck = fetch(`/api/sessions/by-video?videoId=${id}&userId=${encodeURIComponent(userIdRef.current ?? '')}`)
      .then(r => r.json() as Promise<{ session: import('@/types').CpSession | null }>)
      .catch(() => ({ session: null }))

    // Phase 1: meta + InnerTube-only transcript in parallel (~1-3s, no Gemini fallback)
    const metaPromise = fetch(`/api/youtube?id=${id}&meta=1`)
      .then(r => r.json() as Promise<{ meta: { title: string; description: string; channelTitle: string } | null }>)
      .catch(() => ({ meta: null }))

    const quickPromise = fetch(`/api/youtube?id=${id}&quick=1`)
      .then(r => r.json() as Promise<{ transcript: import('@/lib/youtube-transcript').TranscriptEntry[]; meta: { title: string; channelTitle: string; description: string } | null; isLive?: boolean }>)
      .catch(() => ({ transcript: [], meta: null, isLive: false }))

    const [{ meta }, { transcript: quickEntries, meta: quickMeta, isLive: live }, { session: cached }] =
      await Promise.all([metaPromise, quickPromise, cacheCheck])

    if (meta?.title) setVideoTitle(meta.title)
    if (quickMeta?.title) setVideoTitle(v => v ?? quickMeta.title)
    setIsYoutubeLive(!!live)

    // If we have a cached session with saved work:
    //  - from history / shared link (autoRestore) → restore it immediately, no banner
    //  - manual paste → offer the restore banner (don't clobber unexpectedly)
    let restored = false
    if (cached && ((cached.cards?.length ?? 0) > 0 || (cached.transcript?.length ?? 0) > 0)) {
      setSessionId(cached.sessionId)
      if (opts?.autoRestore) {
        restoreSessionData(cached)
        restored = (cached.transcript?.length ?? 0) > 0   // skip re-fetching/re-applying the transcript
      } else {
        setSessionRestoreBanner({
          sessionId: cached.sessionId,
          cardCount: cached.cards?.length ?? 0,
          transcriptCount: cached.transcript?.length ?? 0,
        })
      }
    } else {
      // New session
      const newSessionId = Math.random().toString(36).slice(2) + Date.now().toString(36)
      setSessionId(newSessionId)
      // NOTE: do NOT send transcript:[]/cards:[] here — with merge:true those empty arrays
      // would clobber transcript/card saves that race ahead of this create.
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: newSessionId, userId: userIdRef.current ?? '', videoId: id,
          videoUrl: url, videoTitle: meta?.title ?? quickMeta?.title ?? null,
          channelTitle: meta?.channelTitle ?? quickMeta?.channelTitle ?? null,
          createdAt: Date.now(), updatedAt: Date.now(),
        }),
      }).catch(() => { /* best-effort */ })
    }

    const applyTranscript = (loaded: import('@/lib/youtube-transcript').TranscriptEntry[], sid: string | null) => {
      setFullTranscript(loaded)
      if (!live && loaded.length > 0) {
        setYtLinesPreloaded(true)
        transcript.appendAll(loaded)
        setTranscriptTab('cc')
        lastAnalyzedMsRef.current = -1
        // Persist transcript to session
        if (sid) {
          fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sid, transcript: loaded }),
          }).catch(() => { /* best-effort */ })
        }
      }
    }

    const raw = quickEntries ?? []
    if (restored) {
      // Transcript already applied from the saved session — don't re-fetch/re-append (would duplicate lines).
    } else if (raw.length > 0 || live) {
      const loaded = (!live && raw.length > 0) ? chunkTranscriptEntries(raw) : raw
      setTranscriptStatus(loaded.length > 0 ? 'ready' : (live ? 'live' as TranscriptStatus : 'empty'))
      applyTranscript(loaded, sessionIdRef.current)
    } else if (!live) {
      setTranscriptStatus('ai-loading')
      const phase2Controller = new AbortController()
      const phase2Timeout = setTimeout(() => phase2Controller.abort(), 50_000)
      fetch(`/api/youtube?id=${id}&stage2=1`, { signal: phase2Controller.signal })
        .then(r => r.json() as Promise<{ transcript: import('@/lib/youtube-transcript').TranscriptEntry[] }>)
        .then(({ transcript: entries }) => {
          clearTimeout(phase2Timeout)
          const loaded = chunkTranscriptEntries(entries ?? [])
          setTranscriptStatus(loaded.length > 0 ? 'ready' : 'empty')
          applyTranscript(loaded, sessionIdRef.current)
        })
        .catch(e => {
          clearTimeout(phase2Timeout)
          if ((e as Error)?.name !== 'AbortError') console.error('[phase2] transcript fetch failed', e)
          setTranscriptStatus('empty')
        })
    }
  }

  const handleToggleLive = async () => {
    if (isLive) {
      audioCapture.stop()
      setIsLive(false)
    } else {
      captureStartRef.current = Date.now()
      lastAnalyzedLiveRef.current = -1
      setTranscriptTab('live')
      await audioCapture.startMic()
      setIsLive(true)
    }
  }

  const handleTabAudio = async () => {
    if (isLive) {
      audioCapture.stop()
      setIsLive(false)
    } else {
      captureStartRef.current = Date.now()
      lastAnalyzedLiveRef.current = -1
      setTranscriptTab('live')
      await audioCapture.startTabCapture()
      setIsLive(true)
    }
  }

  // One-shot: when arriving via ?v= / ?url= (e.g. a history click), auto-load the video and
  // auto-restore its saved transcript + fact-checks.
  useEffect(() => {
    if (!pendingAutoLoad) return
    handleLoadUrl(pendingAutoLoad, { autoRestore: true })
    setPendingAutoLoad(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoLoad])

  // Right-pane split: manual checks own the Main tab; auto-checks live on the Auto feed tab.
  // Cards are prepended newest-first, so autoCards[0] is the freshest auto-check. Cards saved
  // before this feature have no `origin` → treat as 'auto' (back-compat).
  const manualCards = cards.filter(c => c.origin === 'manual')
  const autoCards   = cards.filter(c => (c.origin ?? 'auto') === 'auto')
  const latestAuto  = autoCards[0] ?? null

  const renderCard = (card: CounterpointCard) => (
    <EvidenceCard
      key={card.id}
      card={card}
      isActive={activeClaimId === card.claimId}
      onSeek={handleCardSeek}
      onActivate={handleCardActivate}
      onArchive={handleArchiveCard}
      onRerun={handleRerunSources}
    />
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/8 px-4 py-1.5 flex items-center gap-3 bg-[#0d0d14]">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/counterpoints.png" alt="CounterPoints" width={144} height={96} priority className="h-10 sm:h-12 w-auto" />
          <span className="text-[10px] text-indigo-400/60 border border-indigo-500/15 rounded px-1.5 py-0.5 font-mono hidden sm:inline">BETA</span>
        </Link>

        {isLive && (
          <div className="flex items-center gap-1.5 text-xs ml-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 font-medium">LIVE</span>
          </div>
        )}

        <nav className="hidden md:flex items-center gap-1 ml-2">
          <Link href="/"      className="text-xs text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/6 transition-colors">Home</Link>
          <Link href="/about" className="text-xs text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/6 transition-colors">About</Link>
        </nav>

        <div className="flex-1" />
        {userEmail ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(v => !v)}
              title="Account"
              className="flex items-center gap-1.5 text-xs text-indigo-300/80 hover:text-white border border-indigo-500/20 hover:border-white/20 rounded-lg px-3 py-1.5 transition-colors max-w-[200px]"
            >
              <User size={14} className="shrink-0" />
              <span className="truncate">{userEmail}</span>
              <ChevronDown size={13} className="shrink-0 opacity-60" />
            </button>
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 mt-1 w-44 z-50 rounded-lg border border-white/10 bg-[#14141c] shadow-xl py-1">
                  <button onClick={handleSwitchEmail} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white text-left">
                    <LogIn size={13} /> Switch email
                  </button>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-300/80 hover:bg-red-500/10 hover:text-red-200 text-left">
                    <LogOut size={13} /> Log out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowLoginModal(true)}
            className="flex items-center gap-1.5 text-xs text-indigo-200 border border-indigo-500/30 bg-indigo-500/15 hover:bg-indigo-500/25 rounded-lg px-3 py-1.5 transition-colors font-medium"
          >
            <LogIn size={14} /> Log in
          </button>
        )}
        <Link
          href="/history"
          title="History"
          className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 transition-colors"
        >
          <HistoryIcon size={14} /> <span className="hidden sm:inline">History</span>
        </Link>
        <button
          onClick={() => setShowSources(true)}
          title="Sources"
          className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 transition-colors"
        >
          <Radio size={14} /> <span className="hidden sm:inline">Sources</span>
        </button>
        <button
          onClick={() => setShowSettings(true)}
          title="Settings"
          className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 transition-colors"
        >
          <SettingsIcon size={14} /> <span className="hidden sm:inline">Settings</span>
        </button>
      </header>

      {/* URL bar + controls */}
      <div className="border-b border-white/5 px-4 py-2 flex items-center gap-2">
        <input
          type="text"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLoadUrl()}
          placeholder="Paste YouTube URL…"
          className="flex-1 bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/20"
        />
        <button
          onClick={() => handleLoadUrl()}
          disabled={!urlInput || transcriptStatus === 'loading' || transcriptStatus === 'ai-loading'}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm disabled:opacity-40 flex items-center gap-2"
        >
          {(transcriptStatus === 'loading' || transcriptStatus === 'ai-loading') ? (
            <>
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Loading…
            </>
          ) : 'Load'}
        </button>
        <button
          onClick={handleToggleLive}
          title="Capture microphone audio"
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isLive && !audioCapture.isCapturing
              ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
              : isLive
              ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
              : 'bg-white/8 text-gray-300 hover:bg-white/12'
          }`}
        >
          <span className="flex items-center gap-1.5">{isLive ? <><Square size={13} /> Stop</> : <><Mic size={14} /> Mic</>}</span>
        </button>
        <button
          onClick={handleTabAudio}
          title="In the share dialog: select your browser Window and enable 'Also share system audio' to capture embedded video audio"
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
            isLive
              ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : isYoutubeLive
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25 animate-pulse'
              : 'bg-white/6 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-1.5">{isLive ? <><Square size={13} /> Stop Capture</> : <><MonitorPlay size={14} /> Capture Video Audio</>}</span>
        </button>
      </div>

      {/* Session restore banner */}
      {sessionRestoreBanner && (
        <div className="mx-4 mt-1 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-xs flex items-center gap-2">
          <span className="text-indigo-300">🕓</span>
          <span className="text-indigo-200/80 flex-1">
            Found previous session — {sessionRestoreBanner.cardCount} fact-checks, {sessionRestoreBanner.transcriptCount} transcript lines.
          </span>
          <button
            onClick={() => {
              // Restore cards from cached session
              fetch(`/api/sessions/by-video?videoId=${videoId}&userId=${encodeURIComponent(userIdRef.current ?? '')}`)
                .then(r => r.json() as Promise<{ session: import('@/types').CpSession | null }>)
                .then(({ session }) => {
                  if (!session) return
                  if (session.transcript.length > 0) {
                    const loaded = session.transcript
                    setFullTranscript(loaded)
                    setTranscriptStatus('ready')
                    setYtLinesPreloaded(true)
                    transcript.appendAll(loaded)
                    setTranscriptTab('cc')
                  }
                  if (session.cards.length > 0) {
                    setCards(session.cards)
                    const vCount = { true: 0, misleading: 0, false: 0 }
                    let score = 0
                    const vm = new Map<string, import('@/types').Verdict>()
                    for (const c of session.cards) {
                      if (c.verdict === 'TRUE')       { vCount.true++; score = Math.max(0, score - 5) }
                      if (c.verdict === 'MISLEADING') { vCount.misleading++; score = Math.min(100, score + 15) }
                      if (c.verdict === 'FALSE')      { vCount.false++; score = Math.min(100, score + 30) }
                      vm.set(c.claimId, c.verdict)
                    }
                    setVerdictCounts(vCount)
                    setLieScore(score)
                    setClaimVerdicts(vm)
                  }
                  setSessionRestoreBanner(null)
                })
                .catch(() => setSessionRestoreBanner(null))
            }}
            className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition-colors shrink-0"
          >
            Restore
          </button>
          <button onClick={() => setSessionRestoreBanner(null)} className="text-gray-400 hover:text-white shrink-0">✕</button>
        </div>
      )}

      {/* Login prompt modal (shown for anonymous users; reopened via header) */}
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} onLoggedIn={handleLoggedIn} />
      )}

      {/* Setup guide link */}
      {!isLive && (
        <div className="mx-4 mt-1 flex items-center gap-2 text-[10px] text-gray-400">
          <span>Need help capturing audio?</span>
          <button onClick={() => setShowPermissionsGuide(true)} className="text-indigo-400/70 hover:text-indigo-300 underline">
            Setup guide →
          </button>
        </div>
      )}
      {showPermissionsGuide && <PermissionsGuide onClose={() => setShowPermissionsGuide(false)} />}

      {/* Screen-share error toast */}
      {captureError && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 flex items-center gap-2">
          <span>⚠️</span>
          <span>{captureError}</span>
          <button onClick={() => setCaptureError(null)} className="ml-auto text-amber-500 hover:text-amber-300">✕</button>
        </div>
      )}

      {/* Predictive banner */}
      <div className="px-4 pt-1">
        <PredictiveBanner topic={predictiveTopic} />
      </div>

      {/* Main area — video + 2-col layout */}
      <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4 pt-1 gap-2 min-h-0">
        {/* Video row — compact, centered */}
        <div className="shrink-0">
          {xPost ? (
            <XPostEmbed post={xPost} />
          ) : (
            <div className="max-w-md mx-auto relative">
              <VideoPlayer videoId={videoId} containerId={PLAYER_ID} />
              {isYoutubeLive && !isLive && (
                <button
                  onClick={handleTabAudio}
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/60 rounded-xl backdrop-blur-sm hover:bg-black/70 transition-colors cursor-pointer"
                >
                  <span className="text-3xl">📺</span>
                  <span className="text-sm font-semibold text-white">Click to start live transcription</span>
                  <span className="text-[11px] text-gray-400">Select the tab playing your video</span>
                </button>
              )}
            </div>
          )}
          {videoTitle && (
            <div className="text-[11px] text-gray-400 font-medium mt-1 truncate text-center max-w-md mx-auto" title={videoTitle}>
              {videoTitle}
            </div>
          )}
          {videoId && (
            <div className="text-center mt-0.5">
              <a
                href={`https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-400/40 hover:text-blue-400 transition-colors"
              >
                ▸ Open YouTube tab for audio capture
              </a>
            </div>
          )}
        </div>

        {/* Mobile tab bar — one flat 3-tab bar, only below md breakpoint */}
        <div className="flex md:hidden border-b border-white/8 shrink-0">
          {([
            { key: 'transcript', label: '📝 Transcript' },
            { key: 'main',       label: `✅ Your Checks${manualCards.length > 0 ? ` (${manualCards.length})` : ''}` },
            { key: 'auto',       label: `⚡ Auto${autoCards.length > 0 ? ` (${autoCards.length})` : ''}` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setMobileTab(key); if (key !== 'transcript') setRightTab(key) }}
              className={`flex-1 py-2 text-[13px] font-medium transition-colors whitespace-nowrap ${
                mobileTab === key ? 'text-white border-b-2 border-indigo-400' : 'text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Two-column content area */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden" style={{ gap: '0' }}>

          {/* Left: Transcript */}
          <div
            className={`${
              expandedPanel === 'checks' ? 'hidden' :
              expandedPanel === 'transcript' ? 'flex flex-1' :
              mobileTab === 'transcript' ? 'flex' : 'hidden md:flex'
            } flex-1 flex-col min-h-0 w-full rounded-xl border border-white/8 bg-[#0d0d14] overflow-hidden`}
            style={isDesktop && !expandedPanel ? { flexBasis: `calc(${splitRatio * 100}% - 3px)`, flexGrow: 0, flexShrink: 0 } : undefined}
          >
            {/* Transcript panel header */}
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/6">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Transcript</span>
                {(transcriptStatus === 'loading' || transcriptStatus === 'ai-loading') && (
                  <span className="text-[10px] text-yellow-400 flex items-center gap-1">
                    <span className="w-2 h-2 border border-yellow-400/50 border-t-yellow-400 rounded-full animate-spin" />
                    {transcriptStatus === 'ai-loading' ? 'Transcribing via AI (~30-60s, cached after)…' : 'Fetching captions…'}
                  </span>
                )}
                {isAnalyzing && !checkingClaim && (
                  <span className="text-[10px] text-blue-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 border border-blue-400/50 border-t-blue-400 rounded-full animate-spin" />
                    scanning…
                  </span>
                )}
                {transcript.lines.some(l => l.source === 'cc') && transcript.lines.some(l => l.source === 'live') && (
                  <div className="flex gap-1 ml-1">
                    {(['cc', 'live'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setTranscriptTab(t)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                          transcriptTab === t ? 'bg-white/10 text-white border-white/20' : 'text-gray-400 border-transparent hover:text-gray-400'
                        }`}
                      >
                        {t === 'live' ? 'Live' : 'CC'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {ytLinesPreloaded && transcript.lines.length > 0 && (
                  <button
                    onClick={() => setScrollTrigger(n => n + 1)}
                    className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-gray-300 hover:text-white hover:border-white/20"
                  >
                    ▶ Now
                  </button>
                )}
                {(transcriptStatus === 'ready' || isLive) && (
                  <button
                    onClick={analyzeNow}
                    disabled={isAnalyzing}
                    className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-gray-300 hover:text-white hover:border-white/20 disabled:opacity-40 flex items-center gap-1"
                  >
                    {isAnalyzing ? <><span className="w-2 h-2 border border-white/30 border-t-white rounded-full animate-spin" /> Analyzing…</> : '⚡ Analyze'}
                  </button>
                )}
                <button
                  onClick={() => setExpandedPanel(p => p === 'transcript' ? null : 'transcript')}
                  title={expandedPanel === 'transcript' ? 'Restore split view' : 'Expand (Esc to exit)'}
                  className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                >
                  {expandedPanel === 'transcript' ? '⊡' : '⛶'}
                </button>
              </div>
            </div>
            {/* Transcript body */}
            <div className="flex-1 min-h-0 relative" ref={transcriptAreaRef}>
              <VerifyTooltip containerRef={transcriptAreaRef} onBreakdown={text => handleManualCheck(text, 0)} />
              {transcript.lines.length === 0 && (
                <p className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 italic p-4 text-center">
                  {transcriptStatus === 'ready'
                    ? (isYoutubeLive
                        ? 'Live stream — CC captions unavailable. Click 📺 Capture Video Audio.'
                        : 'Captions loaded — auto-checking every 5s.')
                    : transcriptStatus === 'live'
                    ? 'Live stream — auto-checking every 3s.'
                    : transcriptStatus === 'loading'
                    ? 'Fetching captions…'
                    : transcriptStatus === 'ai-loading'
                    ? 'No CC found — AI is transcribing the audio (~30-60s). Cached after first load.'
                    : 'Paste a YouTube URL above, or click 📺 / 🎙 to capture audio.'}
                </p>
              )}
              <TranscriptPanel
                lines={transcript.lines.filter(l => (l.source ?? 'live') === transcriptTab)}
                currentMs={Math.round(currentSec * 1000)}
                claimVerdicts={claimVerdicts}
                activeClaimId={activeClaimId}
                scrollTrigger={scrollTrigger}
                isLive={audioCapture.isCapturing}
                liveMode={transcriptTab === 'live'}
                preloaded={ytLinesPreloaded && transcriptTab === 'cc'}
                onSeek={ms => { seekTo(ms / 1000); setScrollTrigger(n => n + 1) }}
                onClaimClick={handleClaimClick}
                onManualCheck={handleManualCheck}
              />
            </div>
          </div>

          {/* Drag handle — desktop only, hidden when a panel is expanded */}
          {!expandedPanel && (
            <div
              className="hidden md:flex items-center justify-center w-3 shrink-0 cursor-col-resize group self-stretch"
              onMouseDown={e => {
                e.preventDefault()
                const startX = e.clientX
                const startRatio = splitRatio
                const container = (e.currentTarget as HTMLElement).parentElement
                const onMove = (mv: MouseEvent) => {
                  const w = container?.clientWidth ?? 1
                  setSplitRatio(Math.max(0.2, Math.min(0.8, startRatio + (mv.clientX - startX) / w)))
                }
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove)
                  window.removeEventListener('mouseup', onUp)
                }
                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup', onUp)
              }}
            >
              <div className="w-px h-10 bg-white/10 group-hover:bg-indigo-400/40 rounded-full transition-colors" />
            </div>
          )}

          {/* Right: Credibility + Cards */}
          <div
            className={`${
              expandedPanel === 'transcript' ? 'hidden' :
              expandedPanel === 'checks' ? 'flex flex-1' :
              mobileTab !== 'transcript' ? 'flex' : 'hidden md:flex'
            } flex-1 flex-col min-h-0 w-full rounded-xl border border-white/8 bg-[#0d0d14] overflow-hidden`}
            style={isDesktop && !expandedPanel ? { flexBasis: `calc(${(1 - splitRatio) * 100}% - 3px)`, flexGrow: 0, flexShrink: 0 } : undefined}
          >
            {/* Right-pane header = the tab menu (sits ABOVE the gauge), as a segmented control so it
                clearly reads as tabs. Desktop only — the mobile 3-tab bar drives this on phones. */}
            <div className="shrink-0 hidden md:flex items-center gap-2 border-b border-white/8 px-3 py-2">
              {cards.length > 0 ? (
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/30 border border-white/10">
                  {([
                    ['main', `Your Checks${manualCards.length ? ` (${manualCards.length})` : ''}`],
                    ['auto', `Auto Feed${autoCards.length ? ` (${autoCards.length})` : ''}`],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setRightTab(key)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md border transition-colors ${
                        rightTab === key
                          ? 'bg-indigo-500/25 text-white border-indigo-400/40'
                          : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">Fact-Checks</span>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setExpandedPanel(p => p === 'checks' ? null : 'checks')}
                title={expandedPanel === 'checks' ? 'Restore split view' : 'Expand (Esc to exit)'}
                className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-gray-300 hover:text-white hover:border-white/20"
              >
                {expandedPanel === 'checks' ? '⊡' : '⛶'}
              </button>
            </div>

            {/* Scrollable body — gauge + banners + cards live here so the tab menu stays pinned */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">

            {/* PantsOnFire — compact single-row meter (counts live inside it, so no separate summary bar) */}
            <div className="shrink-0 rounded-xl border border-white/6 bg-[#0d0d14] overflow-hidden">
              <PantsOnFire
                compact
                score={lieScore}
                verdictCounts={verdictCounts}
                stressLevel={null}
                cards={cards}
              />
            </div>
            {reconcileNote && (
              <div className="shrink-0 border border-purple-500/25 rounded-xl bg-purple-500/5 px-3 py-2 flex items-start gap-2">
                <span className="text-purple-300 text-sm mt-0.5">⚖</span>
                <p className="text-xs text-purple-200/80 leading-snug">{reconcileNote}</p>
              </div>
            )}
            {checkingClaim && (
              <div className="shrink-0 border border-indigo-500/25 rounded-xl bg-indigo-500/5 px-3 py-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                <p className="text-xs text-white/80 truncate">&ldquo;{checkingClaim}&rdquo;</p>
                <span className="text-[10px] text-indigo-400/60 shrink-0 ml-auto">checking…</span>
              </div>
            )}
            {predictiveTopic && cards.length > 0 && (
              <div className="shrink-0 border border-amber-500/15 rounded-xl bg-amber-500/4 px-3 py-2 flex items-center gap-2">
                <span className="text-[10px] font-semibold text-amber-400/80">🔮</span>
                <p className="text-xs text-amber-200/70 truncate">{predictiveTopic}</p>
              </div>
            )}
            {/* Nothing checked yet */}
            {cards.length === 0 && transcriptStatus !== 'idle' && (
              <p className="text-xs text-gray-400 italic text-center py-8">
                {transcriptStatus === 'ready' || isLive ? 'Monitoring for claims…' : 'Load a video to start fact-checking.'}
              </p>
            )}

            {/* MAIN tab — your manual checks, with the single latest auto-check pinned on top */}
            {rightTab === 'main' && (
              <>
                {latestAuto && (
                  <div className="shrink-0 space-y-1">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-semibold text-indigo-400/70 uppercase tracking-wider">⚡ Latest auto-check</span>
                      {autoCards.length > 1 && (
                        <button
                          onClick={() => setRightTab('auto')}
                          className="text-[10px] text-indigo-400/70 hover:text-indigo-300 transition-colors"
                        >
                          See more auto facts ({autoCards.length}) →
                        </button>
                      )}
                    </div>
                    {renderCard(latestAuto)}
                  </div>
                )}
                {manualCards.length > 0
                  ? manualCards.map(renderCard)
                  : cards.length > 0 && (
                    <p className="text-xs text-gray-400 italic text-center py-6 px-3">
                      Click any transcript sentence — or highlight text — to fact-check it here.
                    </p>
                  )}
              </>
            )}

            {/* AUTO tab — the full background feed */}
            {rightTab === 'auto' && (
              autoCards.length > 0
                ? autoCards.map(renderCard)
                : cards.length > 0 && (
                  <p className="text-xs text-gray-400 italic text-center py-6 px-3">
                    No auto-checks yet — they appear here as claims are detected.
                  </p>
                )
            )}
            </div>{/* /scrollable body */}
          </div>

        </div>
      </div>

      <AlertFlash verdict={latestVerdict?.verdict ?? null} claim={latestVerdict?.claim ?? ''} />

      {/* Footer */}
      <footer className="border-t border-white/8 px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 bg-[#0d0d14]">
        <span className="text-[11px] text-gray-400 font-medium">© CounterPoints 2026</span>
        <nav className="flex items-center gap-x-4 gap-y-1 flex-wrap">
          <Link href="/"      className="text-[11px] text-gray-400 hover:text-white transition-colors">Home</Link>
          <Link href="/about" className="text-[11px] text-gray-400 hover:text-white transition-colors">About</Link>
          <button
            onClick={() => setShowPermissionsGuide(true)}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-colors"
          >
            <HelpCircle size={13} /> How it works
          </button>
          <button onClick={() => setShowSources(true)} className="text-[11px] text-gray-400 hover:text-white transition-colors">Sources</button>
          <a
            href="https://github.com/skylacking04/counterpoints"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-colors"
          >
            <GithubMark size={13} /> GitHub
          </a>
        </nav>
        <div className="flex-1" />
        <span className="text-[11px] text-gray-300 hidden sm:inline">Watch anything. See every side.</span>
      </footer>

      {showSources && <SourcesPanel onClose={() => setShowSources(false)} />}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
