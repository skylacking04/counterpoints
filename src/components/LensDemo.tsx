'use client'
import { useState } from 'react'

// Interactive homepage demo of the multi-lens fact-check — one sample source per perspective,
// for a single illustrative claim, ending in the reconciled "Full Picture" verdict.
type LensKey = 'grok' | 'left' | 'center' | 'right' | 'alt' | 'full'

const DEMO_CLAIM = 'New renewable energy is now cheaper than fossil fuels.'

const LENSES: {
  key: LensKey; label: string; color: string; bg: string; border: string
  source: string; quote: string
}[] = [
  {
    key: 'grok', label: '𝕏 Community', color: 'text-sky-300', bg: 'bg-sky-500/10', border: 'border-sky-500/30',
    source: 'X Community Note',
    quote: '"Costs vary by region, and these figures usually exclude storage and grid-backup needed for reliability."',
  },
  {
    key: 'left', label: 'Left', color: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/30',
    source: 'MSNBC',
    quote: '"Solar and wind are now the cheapest sources of new electricity in most of the world."',
  },
  {
    key: 'center', label: 'Center', color: 'text-slate-200', bg: 'bg-slate-500/10', border: 'border-slate-400/30',
    source: 'Reuters',
    quote: '"New-build renewables undercut new fossil plants on cost in many markets; existing plants are a different comparison."',
  },
  {
    key: 'right', label: 'Right', color: 'text-red-300', bg: 'bg-red-500/10', border: 'border-red-500/30',
    source: 'Fox News',
    quote: '"Cheaper on paper — but the numbers lean on subsidies and leave out reliability and backup costs."',
  },
  {
    key: 'alt', label: 'Alt / Honest', color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30',
    source: 'Independent analyst',
    quote: '"Levelized cost looks great until you price in intermittency, transmission, and storage at scale."',
  },
  {
    key: 'full', label: '⚖ Full Picture', color: 'text-purple-300', bg: 'bg-purple-500/10', border: 'border-purple-500/30',
    source: 'CounterPoints verdict',
    quote: 'MOSTLY TRUE — new-build renewables are often the cheapest source of new power, but total system cost depends on storage and reliability, which both sides selectively emphasize.',
  },
]

export function LensDemo() {
  const [active, setActive] = useState<LensKey>('full')
  const current = LENSES.find(l => l.key === active)!

  return (
    <div className="max-w-2xl mx-auto">
      {/* Sample claim */}
      <div className="text-center mb-5">
        <span className="text-[10px] uppercase tracking-widest text-gray-600">Try a claim</span>
        <p className="text-base sm:text-lg font-medium text-white/90 mt-1">&ldquo;{DEMO_CLAIM}&rdquo;</p>
        <p className="text-[11px] text-gray-600 mt-1">Tap a lens to see how each side covers it →</p>
      </div>

      {/* Lens chips */}
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        {LENSES.map(l => {
          const isActive = l.key === active
          return (
            <button
              key={l.key}
              onClick={() => setActive(l.key)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                isActive ? `${l.color} ${l.bg} ${l.border}` : 'text-gray-500 border-white/8 hover:text-gray-300 hover:border-white/15'
              }`}
            >
              {l.label}
            </button>
          )
        })}
      </div>

      {/* Selected lens source */}
      <div className={`rounded-2xl border ${current.border} ${current.bg} p-5 transition-all`}>
        <div className={`text-[11px] font-bold uppercase tracking-wide ${current.color} mb-2`}>
          {current.key === 'full' ? '⚖ The actual facts' : current.source}
        </div>
        <p className={`text-sm leading-relaxed ${current.key === 'full' ? 'text-purple-100/90 font-medium' : 'text-gray-200'}`}>
          {current.quote}
        </p>
      </div>

      <p className="text-center text-[11px] text-gray-600 mt-4">
        Real checks pull live sources: X Community Notes · Reuters · AP · Fox News · MSNBC · The Hill · Grayzone · PolitiFact and more.
      </p>
    </div>
  )
}
