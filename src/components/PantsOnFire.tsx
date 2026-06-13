'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CounterpointCard } from '@/types'

interface Props {
  score: number
  verdictCounts: { true: number; misleading: number; false: number }
  stressLevel: 'calm' | 'elevated' | 'high' | null
  cards?: CounterpointCard[]
  compact?: boolean
}

const HEAT_LEVELS = [
  { min: 0,  max: 15,  label: 'All Clear',     sub: 'Claims checking out',        color: '#22c55e', ringColor: 'rgba(34,197,94,0.12)' },
  { min: 15, max: 35,  label: 'Getting Warm',  sub: 'Minor inconsistencies',      color: '#84cc16', ringColor: 'rgba(132,204,22,0.12)' },
  { min: 35, max: 55,  label: 'Heating Up',    sub: 'Misleading claims detected', color: '#f59e0b', ringColor: 'rgba(245,158,11,0.15)' },
  { min: 55, max: 75,  label: 'On Fire 🔥',    sub: 'Multiple false claims',      color: '#f97316', ringColor: 'rgba(249,115,22,0.18)' },
  { min: 75, max: 90,  label: 'Liar Liar',     sub: 'Pants igniting',             color: '#ef4444', ringColor: 'rgba(239,68,68,0.20)' },
  { min: 90, max: 101, label: 'LIAR LIAR 🔥',  sub: 'Pants fully on fire',        color: '#dc2626', ringColor: 'rgba(220,38,38,0.25)' },
]

function getLevel(score: number) {
  return HEAT_LEVELS.find(l => score >= l.min && score < l.max) ?? HEAT_LEVELS[0]
}

// Credibility arc gauge — 220° sweep from bottom-left to bottom-right
function CredibilityGauge({ score, color }: { score: number; color: string }) {
  const R = 38, CX = 50, CY = 56
  const START = 200, SWEEP = 220
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180
  const pt = (d: number) => ({ x: CX + R * Math.cos(toRad(d)), y: CY + R * Math.sin(toRad(d)) })
  const arc = (endDeg: number) => {
    const s = pt(START), e = pt(endDeg), large = endDeg - START > 180 ? 1 : 0
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
  }
  const filled = START + (score / 100) * SWEEP

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <path d={arc(START + SWEEP)} fill="none" stroke="#ffffff10" strokeWidth="9" strokeLinecap="round" />
      <motion.path
        d={arc(Math.max(START + 1, filled))}
        fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: score / 100 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
      <text x="50" y="61" textAnchor="middle" fontSize="20" fontWeight="bold"
        fill="white" fontFamily="monospace" style={{ userSelect: 'none' }}>
        {score}
      </text>
    </svg>
  )
}

// Interactive breakdown of what was lied about
function BreakdownPanel({ cards, onClose }: { cards: CounterpointCard[]; onClose: () => void }) {
  const false_cards = cards.filter(c => c.verdict === 'FALSE')
  const misleading  = cards.filter(c => c.verdict === 'MISLEADING')
  const verified    = cards.filter(c => c.verdict === 'TRUE')

  const sections = [
    { label: 'Outright False',  items: false_cards, color: 'text-red-300',    dot: 'bg-red-400',    border: 'border-red-500/20',    bg: 'bg-red-500/8' },
    { label: 'Misleading',      items: misleading,  color: 'text-amber-300',  dot: 'bg-amber-400',  border: 'border-amber-500/20',  bg: 'bg-amber-500/8' },
    { label: 'Verified True',   items: verified,    color: 'text-green-300',  dot: 'bg-green-400',  border: 'border-green-500/20',  bg: 'bg-green-500/8' },
  ].filter(s => s.items.length > 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-x-0 top-full mt-1 z-50 bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <span className="text-xs font-semibold text-white/80">Credibility Breakdown</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-xs">✕</button>
      </div>

      {sections.length === 0 ? (
        <p className="text-xs text-gray-500 italic p-4">No claims checked yet.</p>
      ) : (
        <div className="max-h-72 overflow-y-auto p-3 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          {sections.map(sec => (
            <div key={sec.label}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${sec.dot}`} />
                <span className={`text-[11px] font-bold uppercase tracking-wider ${sec.color}`}>{sec.label}</span>
                <span className="text-[10px] text-gray-600">({sec.items.length})</span>
              </div>
              <div className="space-y-1">
                {sec.items.map(card => (
                  <div key={card.id} className={`rounded-lg px-3 py-2 border ${sec.border} ${sec.bg}`}>
                    <p className="text-xs text-white/85 leading-snug">"{card.claim}"</p>
                    {card.verdictSummary && (
                      <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">{card.verdictSummary}</p>
                    )}
                    {card.transcriptOffsetMs != null && card.transcriptOffsetMs > 0 && (
                      <span className="text-[10px] text-gray-600 font-mono">
                        @ {Math.floor(card.transcriptOffsetMs / 60000)}:{String(Math.floor((card.transcriptOffsetMs % 60000) / 1000)).padStart(2,'0')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

export function PantsOnFire({ score, verdictCounts, stressLevel, cards = [], compact = false }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const level = getLevel(score)
  const total = verdictCounts.true + verdictCounts.misleading + verdictCounts.false
  const isShaking = score >= 85

  if (compact) {
    return (
      <div className="relative select-none">
        <button
          onClick={() => setShowBreakdown(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/3 transition-colors"
        >
          <motion.div
            className="shrink-0 w-9 h-9"
            animate={isShaking ? { x: [-1, 1, -1, 1, 0] } : {}}
            transition={isShaking ? { duration: 0.15, repeat: Infinity, repeatDelay: 3 } : {}}
          >
            <CredibilityGauge score={score} color={level.color} />
          </motion.div>
          <div className="font-bold text-sm" style={{ color: level.color }}>{level.label}</div>
          <div className="text-[10px] text-gray-600 hidden sm:block">{level.sub}</div>
          <div className="flex items-center gap-3 ml-auto">
            {verdictCounts.true > 0 && (
              <span className="flex items-center gap-0.5 text-green-400 text-xs">✅ {verdictCounts.true}</span>
            )}
            {verdictCounts.misleading > 0 && (
              <span className="flex items-center gap-0.5 text-amber-400 text-xs">⚠️ {verdictCounts.misleading}</span>
            )}
            {verdictCounts.false > 0 && (
              <span className="flex items-center gap-0.5 text-red-400 text-xs">❌ {verdictCounts.false}</span>
            )}
            {total === 0 && <span className="text-gray-700 text-[10px]">No claims yet</span>}
            <span className="text-[10px] text-gray-700">{showBreakdown ? '▲' : '▼'}</span>
          </div>
        </button>
        {stressLevel && stressLevel !== 'calm' && (
          <div className={`absolute right-4 top-1/2 -translate-y-1/2 text-[10px] px-2 py-0.5 rounded-full border ${
            stressLevel === 'high' ? 'border-red-500/30 text-red-400' : 'border-amber-500/30 text-amber-400'
          }`}>
            🎙 {stressLevel === 'high' ? 'HIGH STRESS' : 'ELEV'}
          </div>
        )}
        <AnimatePresence>
          {showBreakdown && (
            <BreakdownPanel cards={cards} onClose={() => setShowBreakdown(false)} />
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="relative select-none">
      <div className="flex gap-3 p-4 items-center">
        {/* Gauge — click to toggle breakdown */}
        <motion.button
          onClick={() => setShowBreakdown(v => !v)}
          className="relative shrink-0 w-20 h-20 focus:outline-none"
          title="Click to see breakdown"
          animate={isShaking ? { x: [-1, 1, -1, 1, 0] } : {}}
          transition={isShaking ? { duration: 0.15, repeat: Infinity, repeatDelay: 2 } : {}}
        >
          <div
            className="absolute inset-0 rounded-full blur-xl opacity-50 pointer-events-none"
            style={{ background: level.ringColor }}
          />
          <CredibilityGauge score={score} color={level.color} />
        </motion.button>

        {/* Right side: score + breakdown */}
        <div className="flex-1 min-w-0">
          {/* Heat label */}
          <div className="font-bold text-sm" style={{ color: level.color }}>
            {level.label}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5 mb-2">{level.sub}</div>

          {/* Heat bar */}
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-3">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, #22c55e, ${level.color})` }}
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>

          {/* Verdict badges — click to expand breakdown */}
          <button
            onClick={() => setShowBreakdown(v => !v)}
            className="flex items-center gap-3 text-xs hover:opacity-80 transition-opacity"
            title="Click for breakdown"
          >
            {verdictCounts.true > 0 && (
              <span className="flex items-center gap-1 text-green-400">
                <span className="text-[10px]">✅</span> {verdictCounts.true}
              </span>
            )}
            {verdictCounts.misleading > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <span className="text-[10px]">⚠️</span> {verdictCounts.misleading}
              </span>
            )}
            {verdictCounts.false > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <span className="text-[10px]">❌</span> {verdictCounts.false}
              </span>
            )}
            {total === 0 && <span className="text-gray-600 text-[11px]">No claims yet</span>}
            {total > 0 && (
              <span className="text-[10px] text-gray-600 ml-auto">
                {showBreakdown ? '▲' : '▼'} details
              </span>
            )}
          </button>

          {stressLevel && stressLevel !== 'calm' && (
            <div className={`mt-2 text-[10px] px-2 py-0.5 rounded-full border w-fit ${
              stressLevel === 'high' ? 'border-red-500/30 text-red-400' : 'border-amber-500/30 text-amber-400'
            }`}>
              🎙 {stressLevel === 'high' ? 'HIGH STRESS' : 'ELEVATED'}
            </div>
          )}
        </div>
      </div>

      {/* Expandable breakdown panel */}
      <AnimatePresence>
        {showBreakdown && (
          <BreakdownPanel cards={cards} onClose={() => setShowBreakdown(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
