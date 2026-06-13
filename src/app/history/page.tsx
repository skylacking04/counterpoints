'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { User, Clock } from 'lucide-react'
import type { CpSession, CounterpointCard } from '@/types'

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

interface VideoGroup {
  key: string
  videoId: string
  videoUrl: string
  videoTitle: string | null
  channelTitle: string | null
  latestAt: number
  cards: CounterpointCard[]
  hasTranscript: boolean
}

// Group sessions by video so each video shows once, with all its fact-checks merged.
function groupByVideo(sessions: CpSession[]): VideoGroup[] {
  const map = new Map<string, VideoGroup>()
  for (const s of sessions) {
    const key = s.videoId || s.videoUrl
    if (!key) continue
    const g = map.get(key)
    if (!g) {
      map.set(key, {
        key, videoId: s.videoId, videoUrl: s.videoUrl,
        videoTitle: s.videoTitle, channelTitle: s.channelTitle,
        latestAt: s.createdAt, cards: [...(s.cards ?? [])],
        hasTranscript: (s.transcript?.length ?? 0) > 0,
      })
    } else {
      // merge cards (dedupe by claim text), keep latest metadata
      const seen = new Set(g.cards.map(c => c.claim))
      for (const c of (s.cards ?? [])) if (!seen.has(c.claim)) { g.cards.push(c); seen.add(c.claim) }
      g.hasTranscript = g.hasTranscript || (s.transcript?.length ?? 0) > 0
      if (s.createdAt > g.latestAt) {
        g.latestAt = s.createdAt
        g.videoTitle = s.videoTitle ?? g.videoTitle
        g.channelTitle = s.channelTitle ?? g.channelTitle
        g.videoUrl = s.videoUrl || g.videoUrl
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.latestAt - a.latestAt)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function HistoryPage() {
  const [sessions, setSessions] = useState<CpSession[]>([])
  const [loading, setLoading]   = useState(true)
  const [email, setEmail]       = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [signingIn, setSigningIn]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const groups = useMemo(() => groupByVideo(sessions), [sessions])

  const loadSessions = (userId: string) => {
    setLoading(true)
    fetch(`/api/sessions?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => setSessions(d.sessions ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const userId = localStorage.getItem('cp_user_id') ?? ''
    const savedEmail = localStorage.getItem('cp_user_email')
    if (savedEmail) setEmail(savedEmail)
    if (userId) loadSessions(userId)
    else setLoading(false)
  }, [])

  const handleSignIn = async () => {
    const e = emailInput.trim().toLowerCase()
    if (!EMAIL_RE.test(e)) { setError('Enter a valid email address'); return }
    setError(null)
    setSigningIn(true)
    try {
      const currentId = localStorage.getItem('cp_user_id') ?? ''
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, mergeFromUserId: currentId }),
      })
      if (!res.ok) { setError('Sign-in failed, please try again'); setSigningIn(false); return }
      const { userId } = await res.json() as { userId: string }
      localStorage.setItem('cp_user_id', userId)
      localStorage.setItem('cp_user_email', e)
      setEmail(e)
      setEmailInput('')
      loadSessions(userId)
    } catch {
      setError('Sign-in failed, please try again')
    } finally {
      setSigningIn(false)
    }
  }

  const handleSwitch = () => {
    setEmail(null)
    setSessions([])
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="border-b border-white/8 px-4 py-2 flex items-center gap-3 bg-[#0d0d14]">
        <Link href="/app" className="flex items-center gap-2 shrink-0">
          <Image src="/counterpoints.png" alt="CounterPoints" width={108} height={72} priority className="h-14 w-auto" />
        </Link>
        <nav className="flex items-center gap-1 ml-2">
          <Link href="/app"     className="text-xs text-gray-500 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/6 transition-colors">← Back to App</Link>
          <Link href="/"        className="text-xs text-gray-500 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/6 transition-colors">Home</Link>
        </nav>
        <div className="flex-1" />
        {email && (
          <span className="flex items-center gap-1.5 text-xs text-indigo-300/80 max-w-[180px]">
            <User size={14} className="shrink-0" /> <span className="truncate">{email}</span>
          </span>
        )}
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <h1 className="flex items-center gap-2 text-xl font-bold text-white mb-1"><Clock size={20} className="text-indigo-300/70" /> Your Fact-Check History</h1>
        <p className="text-xs text-gray-500 mb-6">Enter your email to save and retrieve your past videos and fact-checks across devices — no password needed.</p>

        {/* Email login bar */}
        <div className="mb-6 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] p-4">
          {email ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-indigo-300">👤</span>
              <span className="text-white/90">Signed in as <strong>{email}</strong></span>
              <button onClick={handleSwitch} className="ml-auto text-xs text-gray-400 hover:text-white underline">Switch email</button>
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-400 block mb-2">💾 Enter your email to load your saved history</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                  placeholder="you@example.com"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-400/50"
                />
                <button
                  onClick={handleSignIn}
                  disabled={signingIn}
                  className="px-4 py-2 rounded-lg bg-indigo-500/25 border border-indigo-500/40 text-indigo-200 text-sm hover:bg-indigo-500/35 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {signingIn ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  Load history
                </button>
              </div>
              {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="w-3 h-3 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            Loading…
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">No sessions yet.</p>
            <p className="text-gray-500 text-xs mt-1">Load a YouTube URL in the app to start fact-checking.</p>
            <Link href="/app" className="inline-block mt-4 px-4 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm hover:bg-indigo-500/30 transition-colors">
              Open App
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {groups.map(g => {
            const falseCount      = g.cards.filter(c => c.verdict === 'FALSE').length
            const misleadingCount = g.cards.filter(c => c.verdict === 'MISLEADING').length
            const trueCount       = g.cards.filter(c => c.verdict === 'TRUE').length
            const appUrl = g.videoId ? `/app?v=${g.videoId}` : `/app?url=${encodeURIComponent(g.videoUrl)}`
            const thumb = g.videoId ? `https://img.youtube.com/vi/${g.videoId}/mqdefault.jpg` : null
            return (
              <Link
                key={g.key}
                href={appUrl}
                className="block rounded-xl border border-white/8 bg-[#0d0d14] hover:border-white/16 hover:bg-white/3 transition-all p-3"
              >
                <div className="flex items-center gap-3">
                  {thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="w-28 h-16 rounded-lg object-cover shrink-0 border border-white/10" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-white/90 line-clamp-2">
                      {g.videoTitle ?? g.videoUrl}
                    </div>
                    {g.channelTitle && (
                      <div className="text-[11px] text-gray-500 mt-0.5 truncate">{g.channelTitle}</div>
                    )}
                    <div className="text-[10px] text-gray-400 mt-1">{formatDate(g.latestAt)} · {g.cards.length} fact-check{g.cards.length === 1 ? '' : 's'}</div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-2">
                      {trueCount > 0       && <span className="text-xs text-green-400">✅ {trueCount}</span>}
                      {misleadingCount > 0 && <span className="text-xs text-amber-400">⚠️ {misleadingCount}</span>}
                      {falseCount > 0      && <span className="text-xs text-red-400">❌ {falseCount}</span>}
                      {g.cards.length === 0 && <span className="text-[10px] text-gray-500">No claims</span>}
                    </div>
                    <div className="text-[10px] text-gray-400">{g.hasTranscript ? 'Transcript saved' : 'No transcript'}</div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
