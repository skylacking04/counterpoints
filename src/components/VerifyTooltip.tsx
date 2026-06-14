'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  containerRef: React.RefObject<HTMLElement | null>
  onBreakdown?: (text: string) => void
}

interface TooltipPos { x: number; y: number; text: string }

export function VerifyTooltip({ containerRef, onBreakdown }: Props) {
  const [tooltip, setTooltip] = useState<TooltipPos | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onMouseUp = () => {
      const sel = window.getSelection()
      const text = sel?.toString().trim() ?? ''
      if (text.length < 15) { setTooltip(null); return }
      const range = sel!.getRangeAt(0)
      const rect  = range.getBoundingClientRect()
      // Clamp x so the button can't overflow the viewport edge (fixed + -translate-x-1/2 below)
      const half = 70
      const x = Math.max(half + 8, Math.min(window.innerWidth - half - 8, rect.left + rect.width / 2))
      setTooltip({ x, y: rect.top + window.scrollY - 8, text })
    }

    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return
      setTooltip(null)
    }

    el.addEventListener('mouseup', onMouseUp)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      el.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [containerRef])

  const handleBreakdown = () => {
    if (!tooltip || !onBreakdown) return
    onBreakdown(tooltip.text)
    setTooltip(null)
  }

  return (
    <AnimatePresence>
      {tooltip && onBreakdown && (
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
          <button
            onClick={handleBreakdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a2e] border border-indigo-500/30 text-xs font-medium text-indigo-300 hover:text-white hover:border-indigo-400/50 shadow-lg shadow-black/40 whitespace-nowrap"
          >
            ⚡ Fact-check
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
