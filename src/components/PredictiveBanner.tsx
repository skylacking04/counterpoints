'use client'
import { AnimatePresence, motion } from 'framer-motion'

interface Props {
  topic: string | null
}

export function PredictiveBanner({ topic }: Props) {
  return (
    <AnimatePresence>
      {topic && (
        <motion.div
          className="flex items-center gap-2 px-3 py-2 bg-blue-500/8 border border-blue-500/20 rounded-lg text-xs text-blue-300"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          <span className="shrink-0 animate-pulse">🔍</span>
          <span><span className="font-medium">Coming up:</span> {topic} — counterpoints pre-loading…</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
