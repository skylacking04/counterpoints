'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Verdict } from '@/types'

interface Props {
  verdict: Verdict | null
  claim: string
}

const CONFIG = {
  TRUE:       { color: '#27c47a', label: 'VERIFIED ✓',    border: 'border-green-500/60' },
  MISLEADING: { color: '#f5a623', label: 'MISLEADING ⚠️',  border: 'border-yellow-500/60' },
  FALSE:      { color: '#e83b3b', label: 'CAUGHT 🔥',      border: 'border-red-500/60' },
  UNVERIFIED: { color: '#888888', label: 'UNVERIFIED',     border: 'border-gray-500/40' },
}

export function AlertFlash({ verdict, claim }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!verdict) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 3500)
    return () => clearTimeout(t)
  }, [verdict, claim])

  if (!verdict) return null
  const cfg = CONFIG[verdict]

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={`fixed top-6 right-6 z-50 max-w-xs rounded-xl border ${cfg.border} px-4 py-3 backdrop-blur-sm`}
          style={{ backgroundColor: cfg.color + '18' }}
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.25 }}
        >
          <div className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.label}</div>
          <div className="text-xs text-gray-300 mt-1 line-clamp-2">{claim}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
