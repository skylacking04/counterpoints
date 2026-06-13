'use client'
import { useState } from 'react'
import type { CounterpointCard, SpectrumLens, SpectrumItem } from '@/types'
import { SourceBadge } from './SourceBadge'
import { getSourceProfile } from '@/lib/source-db'
import Image from 'next/image'

interface Props {
  card: CounterpointCard
}

type TabKey = SpectrumLens

const TABS: { key: TabKey; label: string; activeClass: string; inactiveClass: string; countClass: string }[] = [
  {
    key: 'grok',   label: '𝕏 Community',
    activeClass:   'bg-sky-500/20 border-sky-400/50 text-sky-200 font-semibold',
    inactiveClass: 'border-sky-500/15 text-sky-400/70 hover:text-sky-300 hover:border-sky-400/30',
    countClass:    'text-sky-500',
  },
  {
    key: 'center', label: 'Center',
    activeClass:   'bg-slate-400/15 border-slate-300/40 text-slate-100 font-semibold',
    inactiveClass: 'border-slate-500/15 text-slate-400 hover:text-slate-200 hover:border-slate-400/30',
    countClass:    'text-slate-500',
  },
  {
    key: 'left',   label: 'Left',
    activeClass:   'bg-blue-500/20 border-blue-400/50 text-blue-200 font-semibold',
    inactiveClass: 'border-blue-500/15 text-blue-400/70 hover:text-blue-300 hover:border-blue-400/30',
    countClass:    'text-blue-500',
  },
  {
    key: 'right',  label: 'Right',
    activeClass:   'bg-red-500/20 border-red-400/50 text-red-200 font-semibold',
    inactiveClass: 'border-red-500/15 text-red-400/70 hover:text-red-300 hover:border-red-400/30',
    countClass:    'text-red-500',
  },
  {
    key: 'alt',    label: 'Alt / Honest',
    activeClass:   'bg-amber-500/20 border-amber-400/50 text-amber-200 font-semibold',
    inactiveClass: 'border-amber-500/15 text-amber-400/70 hover:text-amber-300 hover:border-amber-400/30',
    countClass:    'text-amber-500',
  },
]

const LENS_COLOR: Partial<Record<TabKey, string>> = {
  left:   'border-l-2 border-blue-500/40 pl-2',
  right:  'border-l-2 border-red-500/40 pl-2',
  center: 'border-l-2 border-gray-500/40 pl-2',
  alt:    'border-l-2 border-yellow-500/40 pl-2',
}

// Extract a short readable outlet name from a URL
function outletName(url: string, fallback?: string): string {
  const KNOWN: Record<string, string> = {
    'arxiv.org': 'ArXiv', 'medium.com': 'Medium', 'wsj.com': 'WSJ',
    'foxnews.com': 'Fox News', 'msnbc.com': 'MSNBC', 'reuters.com': 'Reuters',
    'apnews.com': 'AP News', 'thehill.com': 'The Hill', 'theguardian.com': 'Guardian',
    'nytimes.com': 'NY Times', 'washingtonpost.com': 'Washington Post',
    'abcnews.go.com': 'ABC News', 'cnn.com': 'CNN', 'nbcnews.com': 'NBC News',
    'nationalreview.com': 'National Review', 'nypost.com': 'NY Post',
    'dailywire.com': 'Daily Wire', 'thefederalist.com': 'The Federalist',
    'breakingpoints.com': 'Breaking Points', 'thegrayzone.com': 'Grayzone',
    'theintercept.com': 'The Intercept', 'racket.news': 'Racket News',
    'politifact.com': 'PolitiFact', 'factcheck.org': 'FactCheck',
    'snopes.com': 'Snopes', 'sciencedirect.com': 'ScienceDirect',
    'nature.com': 'Nature', 'ncbi.nlm.nih.gov': 'PubMed', 'pubmed.ncbi.nlm.nih.gov': 'PubMed',
    'techcrunch.com': 'TechCrunch', 'wired.com': 'Wired', 'ars technica': 'Ars Technica',
    'arstechnica.com': 'Ars Technica', 'theverge.com': 'The Verge',
  }
  try {
    const h = new URL(url).hostname.replace('www.', '')
    if (KNOWN[h]) return KNOWN[h]
    const sub = h.split('.')
    const base = sub.length >= 2 ? sub[sub.length - 2] : sub[0]
    return base.charAt(0).toUpperCase() + base.slice(1)
  } catch {
    return fallback ?? url
  }
}

function SpectrumItemRow({ item, isXSource }: { item: SpectrumItem; isXSource?: boolean }) {
  const [showNote, setShowNote] = useState(false)
  const profile = getSourceProfile(item.url)
  const outlet = outletName(item.url, item.source)

  // X Community Notes get distinct treatment — they're the gold standard
  if (isXSource) {
    return (
      <div className="border border-blue-500/15 rounded-lg p-3 bg-blue-500/5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-blue-400/80 flex items-center gap-1">
            <span className="text-[11px]">𝕏</span>
            {item.source.startsWith('@') ? item.source : 'Community Note'}
          </span>
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-blue-400/50 hover:text-blue-400">↗</a>
        </div>
        <p className="text-xs text-gray-200 leading-relaxed select-text">"{item.quote}"</p>
      </div>
    )
  }

  return (
    <div className="border border-white/5 rounded-lg p-3 space-y-2">
      {/* Video thumbnail if YouTube clip */}
      {item.videoId && (
        <div className="space-y-2">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 group"
          >
            <div className="relative shrink-0">
              <Image
                src={`https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`}
                alt={item.source}
                width={112}
                height={63}
                className="rounded-lg w-28 h-16 object-cover group-hover:opacity-75 transition"
              />
              {/* Timestamp badge overlaid on thumbnail */}
              {item.videoTimestampSec != null && (
                <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                  {formatTime(item.videoTimestampSec)}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-8 h-8 bg-red-600/80 rounded-full flex items-center justify-center group-hover:bg-red-600 transition">
                  <span className="text-white text-[10px] ml-0.5">▶</span>
                </span>
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white/85">{item.channelName ?? item.source}</div>
              <div className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">{item.source}</div>
              {item.videoTimestampSec != null ? (
                <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-2 py-0.5">
                  ▶ Jump to {formatTime(item.videoTimestampSec)}
                  <span className="text-[9px] text-blue-400/60 ml-0.5">— where he cites this</span>
                </div>
              ) : (
                <div className="mt-1 text-[10px] text-gray-600">Watch for context ↗</div>
              )}
            </div>
          </a>
        </div>
      )}

      {/* Outlet name + bias badge — always visible, no click needed */}
      {!item.videoId && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-white/85 shrink-0">{outlet}</span>
            <SourceBadge profile={profile} className="shrink-0" />
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-blue-400/60 hover:text-blue-400 shrink-0"
            title="Open article"
          >
            ↗
          </a>
        </div>
      )}

      {/* Article title — secondary, truncated */}
      {!item.videoId && item.source && item.source !== outlet && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-[11px] text-gray-500 hover:text-gray-300 truncate leading-tight"
          title={item.source}
        >
          {item.source}
        </a>
      )}

      {/* Quote */}
      <p className="text-xs text-gray-300 leading-relaxed select-text">{item.quote}</p>

      {/* Journalist note */}
      {item.journalistNote && (
        <div>
          <button
            onClick={() => setShowNote(v => !v)}
            className="text-[10px] text-yellow-500/70 hover:text-yellow-400 underline underline-offset-2"
          >
            {showNote ? 'Hide' : 'Author history ↗'}
          </button>
          {showNote && (
            <p className="text-[10px] text-gray-400 mt-1 italic">{item.journalistNote}</p>
          )}
        </div>
      )}

      {item.publishedDate && (
        <div className="text-[10px] text-gray-600">{item.publishedDate}</div>
      )}
    </div>
  )
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function CounterpointsSpectrum({ card }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('grok')

  const items = card.spectrum[activeTab] ?? []

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}>
        {TABS.map(tab => {
          const count = card.spectrum[tab.key]?.length ?? 0
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 text-[11px] px-3 py-1.5 rounded-full border transition-all ${
                isActive ? tab.activeClass : tab.inactiveClass
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1 text-[9px] ${isActive ? 'opacity-70' : tab.countClass}`}>({count})</span>
              )}
            </button>
          )
        })}
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-gray-600 italic px-1">No sources found for this lens.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <SpectrumItemRow
              key={`${item.url || item.source || 'src'}-${i}`}
              item={item}
              isXSource={activeTab === 'grok' && (item.url.includes('x.com/') || item.url.includes('twitter.com/'))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
