'use client'
import { useState, useEffect, memo } from 'react'
import { X, RotateCw } from 'lucide-react'
import type { CounterpointCard, Verdict, SpectrumLens } from '@/types'
import type { CompareResult } from '@/app/api/compare/route'
import { CounterpointsSpectrum } from './CounterpointsSpectrum'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  card: CounterpointCard
  isActive?: boolean
  onSeek?: (offsetMs: number) => void
  onActivate?: (claimId: string, offsetMs: number) => void
  onArchive?: (cardId: string) => void
  onRerun?: (card: CounterpointCard) => void
}

const VERDICT_CONFIG: Record<Verdict, {
  label: string; icon: string
  headerBg: string; headerText: string
  border: string; glow: string
}> = {
  TRUE: {
    label: 'VERIFIED',   icon: '✅',
    headerBg: 'bg-green-500/15', headerText: 'text-green-300',
    border: 'border-green-500/25', glow: 'shadow-green-500/15',
  },
  MISLEADING: {
    label: 'MISLEADING', icon: '⚠️',
    headerBg: 'bg-yellow-500/15', headerText: 'text-yellow-300',
    border: 'border-yellow-500/25', glow: 'shadow-yellow-500/15',
  },
  FALSE: {
    label: 'FALSE',      icon: '❌',
    headerBg: 'bg-red-500/15', headerText: 'text-red-300',
    border: 'border-red-500/25', glow: 'shadow-red-500/20',
  },
  UNVERIFIED: {
    label: 'UNVERIFIED', icon: '?',
    headerBg: 'bg-white/5', headerText: 'text-gray-400',
    border: 'border-white/10', glow: '',
  },
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

// Highlights numbers, percentages, dollar amounts in amber
function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/(\$?[\d,]+\.?\d*\s*(?:%|billion|million|thousand|[BMK])?)/gi)
  return (
    <>
      {parts.map((part, i) =>
        /^\$?[\d,]/.test(part.trim()) ? (
          <span key={i} className="text-amber-300 font-semibold">{part}</span>
        ) : part
      )}
    </>
  )
}

// Splits text into bullet-point sentences
function BulletText({ text, baseClass = 'text-sm text-gray-300' }: { text: string; baseClass?: string }) {
  const sentences = (text.match(/[^.!?]+[.!?]+/g) ?? [text]).map(s => s.trim()).filter(Boolean)
  if (sentences.length <= 1) {
    return (
      <p className={`${baseClass} leading-relaxed`}>
        <HighlightedText text={text} />
      </p>
    )
  }
  return (
    <ul className="space-y-2">
      {sentences.map((s, i) => (
        <li key={i} className="flex gap-2.5 items-start">
          <span className="text-white/20 shrink-0 mt-1 text-base leading-none">•</span>
          <span className={`${baseClass} leading-relaxed`}>
            <HighlightedText text={s} />
          </span>
        </li>
      ))}
    </ul>
  )
}

// Full synthesis panel — fetches /api/compare on mount
function FullAnalysisPanel({ card }: { card: CounterpointCard }) {
  const [data,    setData]    = useState<CompareResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const sources = (['left', 'center', 'right', 'alt', 'grok'] as SpectrumLens[])
      .flatMap(lens => (card.spectrum[lens] ?? []).map(item => ({
        tab: lens, source: item.source, url: item.url, quote: item.quote,
      })))
      .filter(s => s.quote?.trim())

    fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim: card.claim, sources }),
    })
      .then(r => r.json())
      .then(d => setData(d as CompareResult))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id])

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500 py-8 justify-center">
        <span className="w-4 h-4 border-2 border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />
        Synthesizing all perspectives…
      </div>
    )
  }

  if (!data) return <p className="text-xs text-gray-600 italic py-4">No synthesis available yet.</p>

  const lenses: Array<{ key: SpectrumLens; label: string; border: string; text: string; bg: string }> = [
    { key: 'left',   label: 'Left',             border: 'border-blue-500/30',   text: 'text-blue-300',   bg: 'bg-blue-500/5' },
    { key: 'center', label: 'Center',            border: 'border-slate-500/30',  text: 'text-slate-200',  bg: 'bg-slate-400/5' },
    { key: 'right',  label: 'Right',             border: 'border-red-500/30',    text: 'text-red-300',    bg: 'bg-red-500/5' },
    { key: 'alt',    label: 'Alt / Independent', border: 'border-amber-500/30',  text: 'text-amber-300',  bg: 'bg-amber-500/5' },
  ]

  return (
    <div className="space-y-4">
      {/* Underlying facts — bullet list */}
      {data.sharedFacts && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">The Underlying Facts</div>
          <BulletText text={data.sharedFacts} />
          {data.whatTheyAgreeOn && (
            <p className="text-xs text-gray-500 italic border-t border-white/5 pt-2">
              {data.whatTheyAgreeOn}
            </p>
          )}
        </div>
      )}

      {/* Per-lens breakdown */}
      <div className="space-y-2">
        {lenses.map(({ key, label, border, text: textColor, bg }) => {
          const d = data.byLens?.[key]
          if (!d) return null
          return (
            <div key={key} className={`rounded-xl border ${border} ${bg} p-3 space-y-2.5`}>
              <div className={`text-[11px] font-bold uppercase tracking-wider ${textColor}`}>{label}</div>
              {d.source && <div className="text-[10px] text-gray-600">{d.source}</div>}
              {/* Emphasized */}
              <div className="flex gap-2.5 items-start">
                <span className="text-green-400 text-base shrink-0 mt-0.5 leading-none">↑</span>
                <div className="space-y-0.5">
                  <div className="text-[10px] font-semibold text-green-400/80 uppercase tracking-wide">Emphasized</div>
                  <p className="text-sm text-gray-200 leading-relaxed">
                    <HighlightedText text={d.emphasized} />
                  </p>
                </div>
              </div>
              {/* Buried */}
              <div className="flex gap-2.5 items-start">
                <span className="text-red-400/70 text-base shrink-0 mt-0.5 leading-none">↓</span>
                <div className="space-y-0.5">
                  <div className="text-[10px] font-semibold text-red-400/70 uppercase tracking-wide">Buried</div>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    <HighlightedText text={d.buried} />
                  </p>
                </div>
              </div>
              {d.quote && (
                <p className="text-xs text-gray-500 italic border-t border-white/5 pt-2">
                  &ldquo;{d.quote}&rdquo;
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* What mainstream missed */}
      {data.whatMainstreamMissed && (
        <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/8 p-4 space-y-2">
          <div className="text-[10px] font-bold text-yellow-400/80 uppercase tracking-widest">What Mainstream Missed</div>
          <BulletText text={data.whatMainstreamMissed} />
        </div>
      )}

      {/* Full synthesis */}
      {data.fullPicture && (
        <div className="rounded-xl border border-purple-500/25 bg-purple-500/8 p-4 space-y-2">
          <div className="text-[10px] font-bold text-purple-400/80 uppercase tracking-widest">Full Picture</div>
          <BulletText text={data.fullPicture} />
        </div>
      )}
    </div>
  )
}

function EvidenceCardBase({ card, isActive, onSeek, onActivate, onArchive, onRerun }: Props) {
  const [isOpen,   setIsOpen]   = useState(false)
  const [cardView, setCardView] = useState<'sources' | 'analysis'>('sources')
  const cfg = VERDICT_CONFIG[card.verdict]

  useEffect(() => {
    if (isActive) setIsOpen(true)
  }, [isActive])

  return (
    <motion.div
      className={`rounded-xl border ${cfg.border} overflow-hidden bg-[#111] transition-all ${
        isActive ? `shadow-lg ${cfg.glow} ring-1 ring-white/10` : ''
      }`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Compact header row — always visible, click to toggle */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setIsOpen(v => !v)
          onActivate?.(card.claimId, card.transcriptOffsetMs ?? 0)
        }}
        onKeyDown={e => e.key === 'Enter' && (setIsOpen(v => !v), onActivate?.(card.claimId, card.transcriptOffsetMs ?? 0))}
        className={`px-3 py-2.5 flex items-center gap-2 cursor-pointer select-none bg-white/[0.02] hover:bg-white/[0.04] transition-colors`}
      >
        {/* Verdict — prominent colored pill, the most important element */}
        <span className={`flex items-center gap-1 ${cfg.headerBg} ${cfg.headerText} font-bold text-[10px] tracking-wide px-2 py-1 rounded-full shrink-0`}>
          <span className="text-[11px] leading-none">{cfg.icon}</span> {cfg.label}
        </span>
        {/* Claim — fills available space, shown once (no body repeat) */}
        <span className="text-sm text-white/85 truncate flex-1 min-w-0">{card.claim}</span>
        {card.cacheHit && (
          <span
            className="text-[10px] font-medium text-indigo-400/70 shrink-0"
            title={`Knowledge base hit — ${Math.round((card.cacheSimilarity ?? 1) * 100)}% match`}
          >
            ⚡
          </span>
        )}
        {/* Timestamp */}
        {card.transcriptOffsetMs != null && card.transcriptOffsetMs > 0 && onSeek && (
          <button
            onClick={e => { e.stopPropagation(); onSeek(card.transcriptOffsetMs!) }}
            className={`text-[11px] font-mono ${cfg.headerText} bg-black/20 hover:bg-black/40 border border-white/10 rounded-md px-1.5 py-0.5 shrink-0 transition-colors`}
          >
            @ {formatMs(card.transcriptOffsetMs)}
          </button>
        )}
        <span className={`text-[9px] text-gray-600 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
        {onArchive && (
          <button
            onClick={e => { e.stopPropagation(); onArchive(card.id) }}
            title="Dismiss / archive this fact-check"
            className="shrink-0 text-gray-600 hover:text-red-300 hover:bg-red-500/10 rounded p-0.5 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Facts-first body — claim is already in the header, so don't repeat it */}
            <div className="px-4 pt-3 pb-2 space-y-2">
              {/* Lead with the actual facts (the best part) */}
              {card.middleGround ? (
                <div className="rounded-xl border border-purple-500/25 bg-purple-500/[0.07] px-3 py-2.5 flex gap-2">
                  <span className="text-purple-300 text-sm shrink-0 mt-0.5">⚖</span>
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-purple-300/80 mb-0.5">The actual facts</span>
                    <p className="text-sm text-purple-100/90 leading-relaxed select-text"><HighlightedText text={card.middleGround} /></p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-300 leading-relaxed select-text"><HighlightedText text={card.verdictSummary} /></p>
              )}
              {/* Secondary reasoning — small, only when we already led with the facts */}
              {card.middleGround && card.verdictSummary && (
                <p className="text-xs text-gray-500 leading-relaxed select-text"><HighlightedText text={card.verdictSummary} /></p>
              )}
              {card.visionSnapshot?.signals?.length ? (
                <div className="flex flex-wrap gap-1">
                  {card.visionSnapshot.signals.slice(0, 3).map((s, i) => (
                    <span key={i} className="text-[10px] bg-white/5 border border-white/8 rounded-full px-2 py-0.5 text-gray-500 capitalize">{s}</span>
                  ))}
                </div>
              ) : null}
            </div>

            {/* View toggle — Sources | Full Analysis */}
            <div className="flex mx-4 mb-3 rounded-lg overflow-hidden border border-white/8">
              <button
                onClick={() => setCardView('sources')}
                className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                  cardView === 'sources'
                    ? `${cfg.headerBg} ${cfg.headerText}`
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                📰 Sources
              </button>
              <button
                onClick={() => setCardView('analysis')}
                className={`flex-1 py-1.5 text-xs font-medium border-l border-white/8 transition-colors ${
                  cardView === 'analysis'
                    ? 'bg-purple-500/20 text-purple-200'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                ⚖ Full Analysis
              </button>
            </div>

            {onRerun && (
              <div className="flex justify-end mx-4 -mt-1 mb-2">
                <button
                  onClick={() => onRerun(card)}
                  title="Search for fresh sources (bypasses cache)"
                  className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-indigo-300 transition-colors"
                >
                  <RotateCw size={11} /> Re-run sources
                </button>
              </div>
            )}

            {/* Panel content */}
            <div className="px-4 pb-4">
              <AnimatePresence mode="wait" initial={false}>
                {cardView === 'sources' ? (
                  <motion.div
                    key="sources"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <CounterpointsSpectrum card={card} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="analysis"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <FullAnalysisPanel card={card} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Memoized: a settled card shouldn't re-render on the parent's 1s video-time tick. Re-renders only
// when its own card data / isActive changes (callbacks from the parent are stable useCallbacks).
export const EvidenceCard = memo(EvidenceCardBase)
