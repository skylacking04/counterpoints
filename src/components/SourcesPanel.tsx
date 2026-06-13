'use client'
import { useState } from 'react'
import { TRUSTED_CHANNELS, POLITICAL_CHANNELS, type TrustedChannel } from '@/lib/trusted-channels'
import { SOURCE_DB } from '@/lib/source-db'

const BIAS_COLORS: Record<string, string> = {
  'center':       'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'left-center':  'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'left':         'bg-red-500/20 text-red-300 border-red-500/30',
  'right-center': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'right':        'bg-red-500/20 text-red-300 border-red-500/30',
  'alt':          'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
}

const LENS_LABELS: Record<string, string> = {
  center: 'Center',
  left:   'Left',
  right:  'Right',
  alt:    'Alt',
}

interface Props {
  onClose: () => void
}

export function SourcesPanel({ onClose }: Props) {
  const [tab, setTab]               = useState<'channels' | 'outlets'>('channels')
  const [showPoliticalOnly, setShowPoliticalOnly] = useState(false)

  const channels = showPoliticalOnly ? POLITICAL_CHANNELS : TRUSTED_CHANNELS
  const outlets = SOURCE_DB

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <div>
            <h2 className="text-white font-semibold">Trusted Sources</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Pre-configured sources searched for every fact-check
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none ml-4">×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 border-b border-white/5">
          <button
            onClick={() => setTab('channels')}
            className={`px-3 py-1.5 text-xs rounded-t font-medium transition-colors ${
              tab === 'channels'
                ? 'text-white border-b-2 border-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            YouTube Channels ({channels.length})
          </button>
          <button
            onClick={() => setTab('outlets')}
            className={`px-3 py-1.5 text-xs rounded-t font-medium transition-colors ${
              tab === 'outlets'
                ? 'text-white border-b-2 border-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            News Outlets ({outlets.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {tab === 'channels' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-gray-500">
                  Searched for Alt/Independent clips + jump-to-timestamp links.
                  Political claims auto-route to political channels.
                </p>
                <button
                  onClick={() => setShowPoliticalOnly(v => !v)}
                  className={`shrink-0 ml-3 text-[10px] px-2 py-1 rounded border transition-colors ${
                    showPoliticalOnly
                      ? 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10'
                      : 'border-white/10 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  🗳 Political only
                </button>
              </div>
              {channels.map((ch: TrustedChannel) => (
                <div key={ch.channelId} className="flex items-start justify-between bg-white/3 border border-white/5 rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="text-sm text-white font-medium">{ch.name}</div>
                    {ch.description && (
                      <div className="text-[10px] text-gray-500 mt-0.5">{ch.description}</div>
                    )}
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {ch.topics.map(t => (
                        <span key={t} className="text-[9px] bg-white/5 border border-white/8 rounded px-1.5 py-0.5 text-gray-500 capitalize">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className={`shrink-0 text-[10px] border rounded px-2 py-0.5 font-medium ${BIAS_COLORS[ch.lens] ?? BIAS_COLORS['center']}`}>
                    {LENS_LABELS[ch.lens] ?? ch.lens}
                  </div>
                </div>
              ))}
              <div className="mt-3 text-[10px] text-gray-600 italic">
                {POLITICAL_CHANNELS.length} political channels · {TRUSTED_CHANNELS.length} total
              </div>
            </>
          )}

          {tab === 'outlets' && (
            <>
              <p className="text-[11px] text-gray-500 mb-3">
                Searched via Gemini (Google grounding) + Jina Reader fallback. AllSides bias ratings where available.
              </p>
              {(['center', 'left-center', 'left', 'right-center', 'right', 'alt'] as const).map(bias => {
                const group = outlets.filter(o => o.bias === bias)
                if (!group.length) return null
                return (
                  <div key={bias} className="mb-3">
                    <div className={`inline-block text-[10px] border rounded px-2 py-0.5 font-medium mb-2 ${BIAS_COLORS[bias]}`}>
                      {bias.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                    <div className="space-y-1">
                      {group.map(o => (
                        <div key={o.domain} className="flex items-center justify-between bg-white/3 border border-white/5 rounded-lg px-3 py-2">
                          <div>
                            <span className="text-sm text-white">{o.domain}</span>
                            {o.label && (
                              <span className="text-[10px] text-gray-500 ml-2">{o.label}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {o.allSidesRating && (
                              <span className="text-[10px] text-gray-500">{o.allSidesRating}</span>
                            )}
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <span
                                  key={i}
                                  className={`w-1.5 h-1.5 rounded-full ${i < (o.reliability ?? 3) ? 'bg-white/60' : 'bg-white/10'}`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>

        <div className="px-6 pb-5 pt-3 border-t border-white/5">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-white/8 hover:bg-white/12 text-sm text-gray-300 font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
