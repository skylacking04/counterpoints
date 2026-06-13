'use client'
import { useEffect, useRef } from 'react'
import type { TranscriptLine, Verdict, CounterpointCard } from '@/types'
import { EvidenceCard } from './EvidenceCard'

interface Props {
  lines: TranscriptLine[]
  cards: CounterpointCard[]
  currentMs: number
  claimVerdicts: Map<string, Verdict>
  activeClaimId: string | null
  scrollTrigger: number
  isLiveCapture: boolean
  liveMode: boolean
  preloaded: boolean
  containerRef?: React.RefObject<HTMLDivElement | null>
  onSeek: (ms: number) => void
  onClaimClick: (claimId: string, ms: number) => void
  onManualCheck: (text: string, ms: number) => void
  onActivate: (claimId: string, ms: number) => void
  onCardSeek: (ms: number) => void
}

type FeedItem =
  | { kind: 'line'; sortMs: number; line: TranscriptLine }
  | { kind: 'card'; sortMs: number; card: CounterpointCard }

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

function buildFeed(lines: TranscriptLine[], cards: CounterpointCard[]): FeedItem[] {
  const items: FeedItem[] = [
    ...lines.map(l => ({ kind: 'line' as const, sortMs: l.offsetMs, line: l })),
    // Cards appear just after their transcript line (+0.5ms tiebreak)
    ...cards.map(c => ({ kind: 'card' as const, sortMs: (c.transcriptOffsetMs ?? 0) + 0.5, card: c })),
  ]
  return items.sort((a, b) => a.sortMs - b.sortMs)
}

export function UnifiedFeed({
  lines, cards, currentMs, claimVerdicts, activeClaimId,
  scrollTrigger, isLiveCapture, liveMode, preloaded,
  containerRef: externalRef,
  onSeek, onClaimClick, onManualCheck, onActivate, onCardSeek,
}: Props) {
  const internalRef       = useRef<HTMLDivElement>(null)
  const containerRef      = externalRef ?? internalRef
  const activeLineRef     = useRef<HTMLDivElement>(null)
  const activeCardRef     = useRef<HTMLDivElement>(null)
  const currentLineRef    = useRef<HTMLDivElement>(null)
  const lastLinesLen      = useRef(0)
  const userScrolled      = useRef(false)
  const postSeekBlockRef  = useRef(0)

  const feed = buildFeed(lines, cards)

  // Current-line index (for CC playback follow)
  const currentLineIdx = liveMode
    ? lines.length - 1
    : lines.reduce((best, l, i) => l.offsetMs <= currentMs ? i : best, -1)

  // Auto-scroll to bottom for live capture (not preloaded CC)
  useEffect(() => {
    if (lines.length === lastLinesLen.current) return
    lastLinesLen.current = lines.length
    if ((preloaded && !isLiveCapture) || userScrolled.current) return
    if (Date.now() < postSeekBlockRef.current) return
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length, preloaded, isLiveCapture, containerRef])

  // Force-scroll to current line on scrollTrigger
  useEffect(() => {
    if (scrollTrigger == null) return
    userScrolled.current = false
    postSeekBlockRef.current = Date.now() + 3000
    if (currentLineRef.current) {
      currentLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [scrollTrigger])

  // Scroll to active claim line or card
  useEffect(() => {
    if (!activeClaimId) return
    const el = activeLineRef.current ?? activeCardRef.current
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeClaimId])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    if (dist < 60) userScrolled.current = false
    else if (dist > 120) userScrolled.current = true
  }

  if (feed.length === 0) return null

  let lineIdx = -1

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      onScroll={handleScroll}
      className="absolute inset-0 overflow-y-auto px-2 pb-6"
      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.12) transparent' }}
    >
      {feed.map((item, idx) => {
        if (item.kind === 'line') {
          lineIdx++
          const line    = item.line
          const verdict = line.claimId ? (claimVerdicts.get(line.claimId) ?? null) : null
          const isClaim = !!line.claimId
          const isCurrent = lineIdx === currentLineIdx
          const isActive = line.claimId ? line.claimId === activeClaimId : false

          return (
            <div
              key={line.id}
              ref={isActive ? activeLineRef : isCurrent ? currentLineRef : undefined}
              className={`group flex items-start gap-2.5 rounded-lg px-2.5 py-1.5 transition-all ${
                isClaim && verdict === 'FALSE'      ? 'border-l-[3px] border-red-400    bg-red-400/5'    :
                isClaim && verdict === 'MISLEADING' ? 'border-l-[3px] border-yellow-400 bg-yellow-400/5' :
                isClaim && verdict === 'TRUE'       ? 'border-l-[3px] border-green-400  bg-green-400/5'  :
                isClaim                             ? 'border-l-[3px] border-blue-500/40 bg-blue-500/4'  :
                isCurrent                           ? 'border-l-[3px] border-white/50 bg-white/7'        :
                                                      'border-l-[3px] border-transparent hover:bg-white/3'
              } ${isActive ? 'ring-1 ring-white/12' : ''}`}
            >
              <button
                onClick={() => onSeek(line.offsetMs)}
                className={`text-[10px] font-mono shrink-0 mt-0.5 w-9 text-left transition-colors ${
                  isCurrent ? 'text-white/70 font-bold' : 'text-gray-700 hover:text-blue-400'
                }`}
              >
                {formatMs(line.offsetMs)}
              </button>
              <span
                className={`flex-1 text-sm leading-relaxed select-text cursor-pointer ${
                  isCurrent ? 'text-white font-medium' :
                  isClaim && verdict === 'FALSE'      ? 'text-red-100' :
                  isClaim && verdict === 'MISLEADING' ? 'text-yellow-100' :
                  isClaim && verdict === 'TRUE'       ? 'text-green-100' :
                  isClaim ? 'text-blue-200/90' : 'text-gray-300 hover:text-white/80'
                }`}
                onClick={isClaim && line.claimId
                  ? () => onClaimClick(line.claimId!, line.offsetMs)
                  : () => onSeek(line.offsetMs)}
              >
                {line.text}
                {isClaim && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[10px] align-middle opacity-70">
                    {verdict
                      ? <>{verdict === 'FALSE' ? '❌' : verdict === 'MISLEADING' ? '⚠️' : '✅'} <span className="text-white/30">↗</span></>
                      : <span className="text-blue-400 animate-pulse">● checking…</span>
                    }
                  </span>
                )}
              </span>
              {/* Source badge */}
              {line.source && (
                <span className="text-[9px] text-gray-700 shrink-0 mt-1 font-mono uppercase tracking-wide">
                  {line.source}
                </span>
              )}
              {/* ⚡ Check button */}
              {!isClaim && line.text.trim().length > 20 && (
                <button
                  onClick={() => onManualCheck(line.text, line.offsetMs)}
                  className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400/60 hover:bg-indigo-500/25 hover:text-indigo-300 transition-all opacity-0 group-hover:opacity-100"
                >
                  ⚡
                </button>
              )}
            </div>
          )
        }

        // Card
        const card = item.card
        const isActiveCard = card.claimId === activeClaimId
        return (
          <div
            key={`card-${card.id}`}
            id={`card-${card.claimId}`}
            ref={isActiveCard ? activeCardRef : undefined}
            className="my-2 mx-1"
          >
            <EvidenceCard
              card={card}
              isActive={isActiveCard}
              onSeek={onCardSeek}
              onActivate={onActivate}
            />
          </div>
        )
      })}
      <div className="h-4" />
    </div>
  )
}
