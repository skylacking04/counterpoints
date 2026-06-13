'use client'
import { useCallback, useRef, useState } from 'react'
import type { TranscriptLine } from '@/types'

const ROLLING_WINDOW_MS = 90_000

export function useTranscript() {
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const offsetRef = useRef(0)

  const append = useCallback((text: string, offsetMs?: number, source: 'cc' | 'live' = 'live') => {
    const id = Math.random().toString(36).slice(2)
    const off = offsetMs ?? offsetRef.current
    offsetRef.current = off + 10000

    const line: TranscriptLine = { id, text, offsetMs: off, source }

    setLines(prev => {
      const next = [...prev, line]
      // Rolling-window cutoff is per-source so a paused source isn't trimmed by the other's clock
      const cutoff = off - ROLLING_WINDOW_MS
      return next.filter(l => l.source !== source || l.offsetMs >= cutoff)
    })
  }, [])

  const markClaim = useCallback((lineId: string, claimId: string) => {
    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, isClaim: true, claimId } : l
    ))
  }, [])

  const getRollingText = useCallback((): string => {
    return lines.map(l => l.text).join(' ')
  }, [lines])

  // Batch-append all entries at once — no rolling-window cutoff (used for preloaded CC transcripts).
  // Preserves any existing 'live' lines so loading captions doesn't wipe a live capture.
  const appendAll = useCallback((entries: Array<{ text: string; offsetMs: number }>) => {
    const cc: TranscriptLine[] = entries.map((e, i) => ({
      id: Math.random().toString(36).slice(2) + i,
      text: e.text,
      offsetMs: e.offsetMs,
      source: 'cc' as const,
    }))
    setLines(prev => [...prev.filter(l => l.source === 'live'), ...cc])
  }, [])

  const reset = useCallback(() => {
    setLines([])
    offsetRef.current = 0
  }, [])

  const trimBefore = useCallback((cutoffMs: number) => {
    setLines(prev => prev.filter(l => l.offsetMs >= cutoffMs))
  }, [])

  return { lines, append, appendAll, markClaim, getRollingText, reset, trimBefore }
}
