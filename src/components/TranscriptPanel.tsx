'use client'
import { useEffect, useRef } from 'react'
import type { TranscriptLine, Verdict } from '@/types'

interface Props {
  lines: TranscriptLine[]
  currentMs?: number
  preloaded?: boolean    // when true AND not live — batch-loaded; disable auto-scroll
  isLive?: boolean       // when true — mic/tab audio active; override preloaded scroll guard
  liveMode?: boolean     // live-audio tab: highlight the newest line (no seek timeline)
  scrollTrigger?: number // increment from parent to force-scroll to current line
  onSeek?: (offsetMs: number) => void
  onClaimClick?: (claimId: string, offsetMs: number) => void
  onManualCheck?: (text: string, offsetMs: number) => void
  claimVerdicts?: Map<string, Verdict>
  activeClaimId?: string | null
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

const VERDICT_STRIP: Record<Verdict, string> = {
  TRUE:       'border-l-[3px] border-green-400  bg-green-400/8',
  MISLEADING: 'border-l-[3px] border-yellow-400 bg-yellow-400/8',
  FALSE:      'border-l-[3px] border-red-400    bg-red-400/8',
  UNVERIFIED: 'border-l-[3px] border-blue-400   bg-blue-400/5',
}

const VERDICT_TEXT: Record<Verdict, string> = {
  TRUE:       'text-green-100',
  MISLEADING: 'text-yellow-100',
  FALSE:      'text-red-100',
  UNVERIFIED: 'text-blue-100',
}

const VERDICT_BADGE: Record<Verdict, string> = {
  TRUE: '✅', MISLEADING: '⚠️', FALSE: '❌', UNVERIFIED: '?',
}

export function TranscriptPanel({
  lines, currentMs, preloaded, isLive, liveMode, scrollTrigger,
  onSeek, onClaimClick, onManualCheck, claimVerdicts, activeClaimId,
}: Props) {
  const containerRef      = useRef<HTMLDivElement>(null)
  const activeRef         = useRef<HTMLDivElement>(null)
  const currentLineRef    = useRef<HTMLDivElement>(null)
  const lastLinesLen      = useRef(0)
  const userScrolled      = useRef(false)
  const postSeekBlockRef  = useRef(0)  // epoch ms — auto-scroll to bottom blocked until this time

  // Find the line currently being spoken. Live mode has no seek timeline → newest line is "current".
  const currentLineIdx = liveMode
    ? lines.length - 1
    : lines.reduce((best, l, i) => l.offsetMs <= (currentMs ?? 0) ? i : best, -1)

  // Scroll to bottom when new lines are added — ONLY for live streams (not preloaded)
  useEffect(() => {
    if (lines.length === lastLinesLen.current) return
    lastLinesLen.current = lines.length
    if ((preloaded && !isLive) || userScrolled.current) return
    if (Date.now() < postSeekBlockRef.current) return  // user just seeked — don't clobber that scroll
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length, preloaded, isLive])

  // Scroll to the current line ONLY when the parent explicitly asks (▶ Now / seek / claim).
  // If there's no current line (video at 0 / paused), do nothing — never yank to the top.
  useEffect(() => {
    if (scrollTrigger == null) return
    userScrolled.current = false
    postSeekBlockRef.current = Date.now() + 3000  // block live auto-scroll for 3s after a seek
    if (currentLineRef.current) {
      currentLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [scrollTrigger])

  // Scroll to active claim (always intentional)
  useEffect(() => {
    if (activeClaimId && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeClaimId])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distFromBottom < 60) {
      userScrolled.current = false
    } else if (distFromBottom > 120) {
      userScrolled.current = true
    }
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="absolute inset-0 overflow-y-auto space-y-px pr-2"
      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.28) rgba(255,255,255,0.04)' }}
    >
      {lines.length === 0 && (
        <p className="text-gray-600 text-sm italic p-3">
          Paste a YouTube URL above, or click 🎙 Mic to capture audio.
        </p>
      )}

      {lines.map((line, i) => {
        const verdict   = line.claimId ? (claimVerdicts?.get(line.claimId) ?? null) : null
        const isActive  = line.claimId ? line.claimId === activeClaimId : false
        const isClaim   = !!line.claimId
        const isCurrent = i === currentLineIdx && !isClaim

        return (
          <div
            key={line.id}
            ref={isActive ? activeRef : isCurrent ? currentLineRef : undefined}
            className={`group flex gap-3 rounded-lg px-3 py-2 transition-all ${
              isClaim && verdict
                ? VERDICT_STRIP[verdict]
                : isClaim
                ? 'border-l-2 border-blue-500/30 bg-blue-500/[0.04]'
                : isCurrent
                ? 'border-l-2 border-white/30 bg-white/[0.05]'
                : 'hover:bg-white/[0.03] border-l-2 border-transparent'
            } ${isActive ? 'ring-1 ring-white/15' : ''}`}
          >
            {/* Timestamp */}
            <button
              onClick={() => onSeek?.(line.offsetMs)}
              className={`text-[11px] font-mono shrink-0 mt-0.5 w-9 text-left transition-colors ${
                isCurrent ? 'text-white/70 font-bold' : 'text-gray-600 hover:text-blue-400'
              }`}
              title="Jump to this point"
            >
              {formatMs(line.offsetMs)}
            </button>

            {/* Text */}
            <span
              className={`flex-1 text-sm leading-relaxed select-text cursor-pointer ${
                isCurrent
                  ? 'text-white font-medium'
                  : isClaim
                  ? verdict ? VERDICT_TEXT[verdict] : 'text-blue-200/90'
                  : 'text-gray-300 hover:text-white/70'
              }`}
              onClick={isClaim && line.claimId
                ? () => onClaimClick?.(line.claimId!, line.offsetMs)
                : () => onSeek?.(line.offsetMs)}
              title={isClaim ? 'Click to jump to fact-check' : 'Jump to this point in video'}
            >
              {line.text}

              {isClaim && (
                <span className="ml-2 inline-flex items-center gap-1 text-[11px] align-middle">
                  {verdict ? (
                    <>
                      <span>{VERDICT_BADGE[verdict]}</span>
                      <span className="text-[10px] text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">↗ fact-check</span>
                    </>
                  ) : (
                    <span className="text-blue-400 opacity-70 animate-pulse text-[10px]">● checking…</span>
                  )}
                </span>
              )}
            </span>

            {/* ⚡ Check — always visible, not just on hover */}
            {!isClaim && onManualCheck && line.text.trim().length > 20 && (
              <button
                onClick={() => onManualCheck(line.text, line.offsetMs)}
                className="shrink-0 self-start mt-0.5 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400/60 hover:bg-indigo-500/25 hover:text-indigo-300 hover:border-indigo-500/40 transition-all whitespace-nowrap opacity-0 group-hover:opacity-100"
                title="Fact-check this line"
              >
                ⚡ Check
              </button>
            )}
          </div>
        )
      })}
      <div className="h-2" />
    </div>
  )
}
