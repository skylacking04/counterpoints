'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { VideoPlayer } from '@/components/VideoPlayer'
import { useYouTubeSync } from '@/hooks/useYouTubeSync'
import { extractVideoId } from '@/lib/youtube-transcript'
import type { StoredTranscript, TranscriptSegment, HistoryEntry } from '@/types'

const PLAYER_ID = 'sync-test-player'

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

// Last segment whose startMs <= currentMs (segments are sorted ascending).
function activeIdx(segs: TranscriptSegment[], currentMs: number): number {
  let idx = -1
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].startMs <= currentMs) idx = i
    else break
  }
  return idx
}

interface ColumnProps {
  title: string
  badge: string
  segs: TranscriptSegment[]
  currentMs: number
  onSeek: (ms: number) => void
  live?: boolean   // live mode: always track the newest line, show a live badge instead of drift
}

function Column({ title, badge, segs, currentMs, onSeek, live }: ColumnProps) {
  const idx = live ? segs.length - 1 : activeIdx(segs, currentMs)
  const active = idx >= 0 ? segs[idx] : null
  const activeRef = useRef<HTMLDivElement>(null)
  const lastIdx = useRef(-1)

  useEffect(() => {
    if (idx !== lastIdx.current) {
      lastIdx.current = idx
      activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [idx])

  // Drift: 0 when the playhead is inside the active line's [start,end]; otherwise the gap.
  let drift = 0
  let inSync = true
  if (active) {
    if (currentMs < active.startMs) { drift = active.startMs - currentMs; inSync = false }
    else if (currentMs > active.endMs) { drift = currentMs - active.endMs; inSync = false }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-white/8 bg-[#0d0d14] overflow-hidden">
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{title}</span>
          <span className="text-[10px] text-gray-500 border border-white/10 rounded px-1.5 py-0.5">{badge}</span>
          <span className="text-[10px] text-gray-600">{segs.length} lines</span>
        </div>
        {live ? (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-red-400 bg-red-500/10 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> live
          </span>
        ) : active && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${inSync ? 'text-green-400 bg-green-400/10' : 'text-amber-400 bg-amber-400/10'}`}>
            {inSync ? '✓ in sync' : `drift ${(drift / 1000).toFixed(1)}s`}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-1 py-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.28) rgba(255,255,255,0.04)' }}>
        {segs.length === 0 && <p className="text-gray-600 text-sm italic p-3">No transcript from this source.</p>}
        {segs.map((s, i) => {
          const isCurrent = i === idx
          return (
            <div
              key={i}
              ref={isCurrent ? activeRef : undefined}
              className={`flex gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                isCurrent ? 'border-l-[3px] border-white/60 bg-white/8' : 'border-l-[3px] border-transparent hover:bg-white/4'
              }`}
            >
              <button
                onClick={() => onSeek(s.startMs)}
                className={`text-[11px] font-mono shrink-0 mt-0.5 w-9 text-left ${isCurrent ? 'text-white/80 font-bold' : 'text-gray-600 hover:text-blue-400'}`}
                title="Seek here"
              >
                {fmt(s.startMs)}
              </button>
              {s.speaker && (
                <span className="shrink-0 mt-0.5 text-[10px] px-1.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 h-fit">
                  {s.speaker}
                </span>
              )}
              <span className={`flex-1 text-sm leading-relaxed ${isCurrent ? 'text-white font-medium' : 'text-gray-300'}`}>
                {s.text}
              </span>
            </div>
          )
        })}
        <div className="h-2" />
      </div>
    </div>
  )
}

export default function SyncTest() {
  const [urlInput, setUrlInput] = useState('')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [data, setData] = useState<StoredTranscript | null>(null)
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(false)
  // Live mode
  const [liveOn, setLiveOn] = useState(false)
  const [liveSegs, setLiveSegs] = useState<TranscriptSegment[]>([])
  const [liveStatus, setLiveStatus] = useState('')
  const liveSinceRef = useRef(0)
  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const livePollingRef = useRef(false)
  // Identity (email gate, no password)
  const [user, setUser] = useState<{ userId: string; email: string } | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])

  const { currentSec, seekTo } = useYouTubeSync(
    PLAYER_ID,
    videoId,
    [],            // no incremental line sync here — we render the full transcript
    () => {},
    () => {},
    false,
  )
  const currentMs = Math.round(currentSec * 1000)

  const fetchHistory = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/user?userId=${userId}`)
      const d = await res.json() as { history?: HistoryEntry[] }
      setHistory(d.history ?? [])
    } catch { /* ignore */ }
  }, [])

  // Restore identity from localStorage on first load
  useEffect(() => {
    const saved = localStorage.getItem('cp_user')
    if (saved) {
      try {
        const u = JSON.parse(saved) as { userId: string; email: string }
        setUser(u)
        fetchHistory(u.userId)
      } catch { /* ignore */ }
    }
  }, [fetchHistory])

  const saveEmail = useCallback(async () => {
    const email = emailInput.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    try {
      const res = await fetch('/api/user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) return
      const u = await res.json() as { userId: string; email: string }
      setUser(u)
      localStorage.setItem('cp_user', JSON.stringify({ userId: u.userId, email: u.email }))
      fetchHistory(u.userId)
    } catch { /* ignore */ }
  }, [emailInput, fetchHistory])

  const signOut = useCallback(() => {
    localStorage.removeItem('cp_user')
    setUser(null); setHistory([]); setEmailInput('')
  }, [])

  const load = useCallback(async (recall = false) => {
    const url = urlInput.trim()
    if (!url) return
    setLoading(true)
    setData(null)
    setStatus(recall ? 'Recalling from database…' : 'Extracting audio + transcribing (first run can take a few minutes)…')
    setVideoId(extractVideoId(url))
    try {
      const res = recall
        ? await fetch(`/api/transcribe-url?url=${encodeURIComponent(url)}`)
        : await fetch('/api/transcribe-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, userId: user?.userId }),
          })
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { message?: string; error?: string }
        setStatus(`⚠️ ${e.message || e.error || `HTTP ${res.status}`}`)
        return
      }
      const d = await res.json() as StoredTranscript & { cached?: boolean }
      setData(d)
      setStatus(`${d.cached ? '⚡ from cache' : '✓ fresh'} · ${d.whisperSegments?.length ?? 0} whisper / ${d.ccSegments?.length ?? 0} CC lines${d.language ? ` · ${d.language}` : ''}${d.assetKey ? ` · ${d.assetKey}` : ''}`)
      if (user) fetchHistory(user.userId)
    } catch (err) {
      setStatus(`⚠️ ${String(err).slice(0, 200)}`)
    } finally {
      setLoading(false)
    }
  }, [urlInput, user, fetchHistory])

  const pollLive = useCallback(async () => {
    if (livePollingRef.current) return  // skip if previous window still transcribing
    livePollingRef.current = true
    try {
      const res = await fetch('/api/transcribe-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim(), sinceMs: liveSinceRef.current, userId: user?.userId }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { message?: string }
        setLiveStatus(`⚠️ ${e.message || res.status}`)
        return
      }
      const d = await res.json() as { segments: TranscriptSegment[]; nextSinceMs: number }
      liveSinceRef.current = d.nextSinceMs
      if (d.segments?.length) setLiveSegs(prev => [...prev, ...d.segments])
      setLiveStatus(`🔴 live · ${Math.round(liveSinceRef.current / 1000)}s captured`)
    } catch (err) {
      setLiveStatus(`⚠️ ${String(err).slice(0, 120)}`)
    } finally {
      livePollingRef.current = false
    }
  }, [urlInput, user])

  const stopLive = useCallback(() => {
    if (liveTimerRef.current) clearInterval(liveTimerRef.current)
    liveTimerRef.current = null
    setLiveOn(false)
  }, [])

  const startLive = useCallback(() => {
    if (!urlInput.trim()) return
    setLiveOn(true)
    setLiveSegs([])
    liveSinceRef.current = 0
    setLiveStatus('🔴 connecting to live edge…')
    setVideoId(extractVideoId(urlInput.trim()))
    pollLive()
    liveTimerRef.current = setInterval(pollLive, 15_000)
  }, [urlInput, pollLive])

  useEffect(() => () => { if (liveTimerRef.current) clearInterval(liveTimerRef.current) }, [])

  const cc = useMemo(() => data?.ccSegments ?? [], [data])
  const whisper = useMemo(() => data?.whisperSegments ?? [], [data])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="border-b border-white/8 px-4 py-3 flex items-center gap-3 bg-[#0d0d14]">
        <Link href="/app" className="text-sm font-semibold text-indigo-300 hover:text-white">← CounterPoints</Link>
        <span className="text-xs text-gray-500">Transcript Sync Test</span>
        <span className="text-[10px] text-amber-400/70 border border-amber-500/20 rounded px-1.5 py-0.5">no fact-check · timestamp QA only</span>
        <div className="flex-1" />
        {user ? (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-gray-400">💾 saving as <span className="text-indigo-300">{user.email}</span></span>
            <button onClick={signOut} className="text-gray-600 hover:text-gray-300 underline">switch</button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveEmail()}
              placeholder="email to save your transcripts"
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] w-52 outline-none focus:border-white/25 placeholder-gray-600"
            />
            <button onClick={saveEmail} className="text-[11px] px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30">Save</button>
          </div>
        )}
      </header>

      <div className="border-b border-white/5 px-4 py-2 flex items-center gap-2">
        <input
          type="text"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(false)}
          placeholder="Paste a YouTube / X / podcast URL…"
          className="flex-1 bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/20 placeholder-gray-600"
        />
        <button onClick={() => load(false)} disabled={!urlInput || loading}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm disabled:opacity-40 flex items-center gap-2">
          {loading ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Working…</> : 'Transcribe'}
        </button>
        <button onClick={() => load(true)} disabled={!urlInput || loading}
          className="px-3 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-sm disabled:opacity-40" title="Reload persisted transcript by URL">
          ⚡ Recall
        </button>
        <button onClick={() => liveOn ? stopLive() : startLive()} disabled={!urlInput}
          className={`px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40 border ${
            liveOn ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-white/6 text-gray-300 border-white/10 hover:bg-white/10'
          }`}
          title="Roll through a live stream's audio (~15s windows)">
          {liveOn ? '⏹ Stop Live' : '🔴 Start Live'}
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4 pt-3 gap-3 min-h-0">
        <div className="shrink-0 flex flex-col items-center gap-1">
          <div className="max-w-lg w-full">
            <VideoPlayer videoId={videoId} containerId={PLAYER_ID} />
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span className="font-mono">▶ {fmt(currentMs)}</span>
            {data?.title && <span className="truncate max-w-md" title={data.title}>{data.title}</span>}
            {status && <span className="text-gray-500">{status}</span>}
            {(liveOn || liveStatus) && <span className="text-red-400">{liveStatus}</span>}
          </div>
          {!videoId && data && (
            <p className="text-[11px] text-amber-400/70">Non-YouTube source: transcript shown, but playback-synced highlight needs the YouTube player (audio sync is a follow-up).</p>
          )}
        </div>

        {user && history.length > 0 && (
          <div className="shrink-0 border border-white/8 rounded-lg bg-white/[0.02] px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">My Transcripts ({history.length})</div>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
              {history.map(h => (
                <button
                  key={h.urlHash}
                  onClick={() => { setUrlInput(h.url); setTimeout(() => load(true), 0) }}
                  className="shrink-0 text-left px-2.5 py-1.5 rounded-lg border border-white/8 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/15 transition-colors max-w-[220px]"
                  title={`${h.url}\n${h.assetKey ?? ''}`}
                >
                  <div className="text-[11px] text-gray-200 truncate">{h.title || h.url}</div>
                  <div className="text-[9px] text-gray-600 font-mono truncate">{h.assetKey ?? new Date(h.createdAt).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
          {liveOn || liveSegs.length > 0 ? (
            <Column title="Live (Groq Whisper)" badge="rolling ~20s" segs={liveSegs} currentMs={currentMs} onSeek={ms => seekTo(ms / 1000)} live />
          ) : (
            <>
              <Column title="Whisper (Groq)" badge="real ts" segs={whisper} currentMs={currentMs} onSeek={ms => seekTo(ms / 1000)} />
              <Column title="Native CC" badge="youtube" segs={cc} currentMs={currentMs} onSeek={ms => seekTo(ms / 1000)} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
