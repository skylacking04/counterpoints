'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Verdict } from '@/types'

interface VerifyResult {
  verdict: Verdict
  summary: string
  confidence: string
  communityNotes: Array<{ text: string; url: string }>
  xPosts: Array<{ author: string; text: string; url: string }>
  sources: Array<{ url: string; title: string; quote: string }>
}

interface Props {
  containerRef: React.RefObject<HTMLElement | null>
  onBreakdown?: (text: string) => void
}

interface TooltipPos { x: number; y: number; text: string }

const VERDICT_COLOR: Record<Verdict, string> = {
  TRUE:       'text-green-400 border-green-500/30 bg-green-500/10',
  MISLEADING: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
  FALSE:      'text-red-400 border-red-500/30 bg-red-500/10',
  UNVERIFIED: 'text-gray-400 border-gray-600/20 bg-white/5',
}
const VERDICT_LABEL: Record<Verdict, string> = {
  TRUE: '✅ Verified', MISLEADING: '⚠️ Misleading', FALSE: '❌ False', UNVERIFIED: '? Unverified',
}

export function VerifyTooltip({ containerRef, onBreakdown }: Props) {
  const [tooltip, setTooltip]   = useState<TooltipPos | null>(null)
  const [loading, setLoading]   = useState(false)
  const [result,  setResult]    = useState<VerifyResult | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onMouseUp = () => {
      const sel = window.getSelection()
      const text = sel?.toString().trim() ?? ''
      if (text.length < 15) { setTooltip(null); setResult(null); return }
      const range = sel!.getRangeAt(0)
      const rect  = range.getBoundingClientRect()
      setTooltip({ x: rect.left + rect.width / 2, y: rect.top + window.scrollY - 8, text })
      setResult(null)
    }

    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return
      setTooltip(null)
      setResult(null)
    }

    el.addEventListener('mouseup', onMouseUp)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      el.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [containerRef])

  const handleVerify = async () => {
    if (!tooltip || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: tooltip.text }),
      })
      const data = await res.json() as VerifyResult
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  const handleBreakdown = () => {
    if (!tooltip || !onBreakdown) return
    onBreakdown(tooltip.text)
    setTooltip(null)
    setResult(null)
  }

  return (
    <AnimatePresence>
      {tooltip && (
        <motion.div
          ref={panelRef}
          key="tooltip"
          initial={{ opacity: 0, y: 4, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.15 }}
          style={{ left: tooltip.x, top: tooltip.y }}
          className="fixed z-50 -translate-x-1/2 -translate-y-full pointer-events-auto"
        >
          {!result ? (
            /* Action buttons — Verify (quick) + Full Check (full spectrum) */
            <div className="flex gap-1 shadow-lg shadow-black/40">
              <button
                onClick={handleVerify}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a2e] border border-blue-500/30 text-xs font-medium text-blue-300 hover:text-white hover:border-blue-400/50 disabled:opacity-60 whitespace-nowrap"
              >
                {loading ? (
                  <><span className="w-3 h-3 border border-blue-400/40 border-t-blue-400 rounded-full animate-spin" /> Checking…</>
                ) : (
                  <><span className="text-[10px]">𝕏</span> Verify</>
                )}
              </button>
              {onBreakdown && (
                <button
                  onClick={handleBreakdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a2e] border border-indigo-500/30 text-xs font-medium text-indigo-300 hover:text-white hover:border-indigo-400/50 whitespace-nowrap"
                >
                  ⚡ Full Check
                </button>
              )}
            </div>
          ) : (
            /* Verify result panel */
            <div className={`w-80 rounded-xl border p-3 shadow-xl shadow-black/60 bg-[#111] space-y-2 ${VERDICT_COLOR[result.verdict]}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">{VERDICT_LABEL[result.verdict]}</span>
                <span className="text-[10px] opacity-60">{result.confidence} confidence</span>
              </div>

              <p className="text-[11px] text-gray-300 leading-relaxed">{result.summary}</p>

              {result.communityNotes.length > 0 && (
                <div className="space-y-1.5 border-t border-white/8 pt-2">
                  <div className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1">
                    <span className="text-[11px]">𝕏</span> Community Notes
                  </div>
                  {result.communityNotes.slice(0, 2).map((n, i) => (
                    <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                      className="block text-[11px] text-gray-300 hover:text-white bg-white/4 rounded p-2 border border-white/6">
                      &ldquo;{n.text.slice(0, 180)}{n.text.length > 180 ? '…' : ''}&rdquo;
                    </a>
                  ))}
                </div>
              )}

              {result.sources.length > 0 && (
                <div className="space-y-1 border-t border-white/8 pt-2">
                  <div className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Sources</div>
                  {result.sources.slice(0, 2).map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-start gap-1.5 group">
                      <span className="text-[10px] text-blue-400/60 group-hover:text-blue-400 shrink-0 mt-0.5">↗</span>
                      <div className="min-w-0">
                        <div className="text-[10px] font-medium text-white/70 group-hover:text-white truncate">{s.title}</div>
                        <div className="text-[10px] text-gray-500 truncate">{s.quote?.slice(0, 100)}</div>
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {onBreakdown && (
                <button
                  onClick={handleBreakdown}
                  className="w-full mt-1 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-xs text-indigo-300 hover:bg-indigo-500/25 hover:text-white transition-colors"
                >
                  ⚡ Run Full Spectrum Check
                </button>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
