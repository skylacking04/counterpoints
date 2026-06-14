'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Event {
  id: string
  event: string
  page: string | null
  city: string | null
  region: string | null
  country: string | null
  userId: string | null
  ts: string
  meta: Record<string, string | number | boolean>
}

interface DailyCount { date: string; event: string; count: number }

const EVENT_EMOJI: Record<string, string> = {
  page_view:    '👁',
  live_capture: '🎧',
  fact_check:   '⚡',
  url_paste:    '🔗',
  highlight_check: '📝',
}

export default function AdminPage() {
  const [events,  setEvents]  = useState<Event[]>([])
  const [daily,   setDaily]   = useState<DailyCount[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<string>('all')

  useEffect(() => {
    fetch('/api/admin-data?secret=counterpoints-admin')
      .then(r => r.json())
      .then(d => { setEvents(d.events ?? []); setDaily(d.daily ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const eventTypes = ['all', ...Array.from(new Set(events.map(e => e.event)))]
  const shown = filter === 'all' ? events : events.filter(e => e.event === filter)

  // Aggregate cities
  const cityMap: Record<string, number> = {}
  events.forEach(e => {
    if (e.city && e.country) {
      const key = `${e.city}, ${e.country}`
      cityMap[key] = (cityMap[key] ?? 0) + 1
    }
  })
  const topCities = Object.entries(cityMap).sort((a, b) => b[1] - a[1]).slice(0, 12)

  // Daily totals
  const dayTotals: Record<string, number> = {}
  daily.forEach(d => { dayTotals[d.date] = (dayTotals[d.date] ?? 0) + d.count })
  const sortedDays = Object.entries(dayTotals).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14)

  const total = events.length
  const liveCaptures = events.filter(e => e.event === 'live_capture').length
  const factChecks   = events.filter(e => e.event === 'fact_check').length
  const uniqueUsers  = new Set(events.map(e => e.userId).filter(Boolean)).size

  return (
    <div className="min-h-screen bg-[#070710] text-white">
      <nav className="border-b border-white/8 px-5 py-3 flex items-center gap-3">
        <Link href="/app" className="text-sm text-gray-400 hover:text-white">← App</Link>
        <span className="text-xs text-gray-600">|</span>
        <span className="text-sm font-semibold text-white">Admin Analytics</span>
      </nav>

      <main className="max-w-5xl mx-auto px-5 py-8 space-y-8">
        {loading ? (
          <div className="flex items-center gap-3 text-gray-500 py-20 justify-center">
            <span className="w-5 h-5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total events', value: total,        color: 'text-white' },
                { label: 'Live captures', value: liveCaptures, color: 'text-sky-300' },
                { label: 'Fact-checks run', value: factChecks, color: 'text-indigo-300' },
                { label: 'Unique users', value: uniqueUsers,  color: 'text-green-300' },
              ].map(c => (
                <div key={c.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                  <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Top cities */}
            {topCities.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-300 mb-3">Visitors by city</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {topCities.map(([city, count]) => (
                    <div key={city} className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 flex items-center justify-between gap-2">
                      <span className="text-sm text-white truncate">{city}</span>
                      <span className="text-xs font-mono text-indigo-300 shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Daily volume */}
            {sortedDays.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-300 mb-3">Daily event volume</h2>
                <div className="rounded-xl border border-white/8 overflow-hidden">
                  {sortedDays.map(([date, count], i) => (
                    <div key={date} className={`flex items-center gap-3 px-4 py-2 ${i > 0 ? 'border-t border-white/6' : ''} bg-[#0d0d14]`}>
                      <span className="text-xs text-gray-400 w-24 shrink-0">{date}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500/60"
                          style={{ width: `${Math.min(100, (count / (sortedDays[0]?.[1] ?? 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-gray-300 w-8 text-right shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Event feed */}
            <section>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <h2 className="text-sm font-semibold text-gray-300">Recent events</h2>
                <div className="flex gap-1 flex-wrap">
                  {eventTypes.map(t => (
                    <button
                      key={t}
                      onClick={() => setFilter(t)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                        filter === t
                          ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-200'
                          : 'border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      {EVENT_EMOJI[t] ?? '•'} {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/8 overflow-hidden">
                {shown.length === 0 ? (
                  <div className="px-4 py-6 text-xs text-gray-600 text-center">No events yet</div>
                ) : (
                  shown.slice(0, 100).map((e, i) => (
                    <div key={e.id} className={`px-4 py-2 flex items-center gap-3 ${i > 0 ? 'border-t border-white/6' : ''} bg-[#0d0d14]`}>
                      <span className="text-base shrink-0">{EVENT_EMOJI[e.event] ?? '•'}</span>
                      <span className="text-xs font-medium text-white w-28 shrink-0">{e.event}</span>
                      <span className="text-xs text-gray-500 w-20 shrink-0">{e.page ?? '—'}</span>
                      <span className="text-xs text-gray-400 flex-1 min-w-0 truncate">
                        {[e.city, e.region, e.country].filter(Boolean).join(', ') || '—'}
                      </span>
                      <span className="text-[10px] text-gray-600 shrink-0">
                        {e.ts ? new Date(e.ts).toLocaleString() : '—'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
