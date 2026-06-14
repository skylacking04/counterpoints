'use client'
import Link from 'next/link'
import { useState } from 'react'

export default function HowToPage() {
  const [active, setActive] = useState('overview')

  const sections = [
    {
      id: 'overview',
      emoji: '▶',
      label: 'Full walkthrough',
      title: 'Full walkthrough — 2 minutes',
      blurb: 'The complete tour: paste a link or go live, watch claims get fact-checked across every perspective, and read the verdict + counterpoint.',
      youtubeId: '2TaEB2M8b9c',
      steps: [
        'Open the app and paste a YouTube URL, or click "📺 Capture Video Audio" for a live show.',
        'Watch the live transcript fill in on the left as the video plays.',
        'Claims are auto-detected and checked across 𝕏 / Establishment / Center / Left / Right / Independent.',
        'Open any evidence card for the verdict, the actual facts, the counterpoint, and every source.',
      ],
    },
    {
      id: 'live',
      emoji: '🎧',
      label: 'Live transcripts',
      title: 'Capture live & streaming audio',
      blurb: 'Fact-check anything playing in your browser — a YouTube live stream, a web podcast, a Space — with no download and no setup.',
      youtubeId: 'Ac8iCgKT1-E',
      steps: [
        'Open your show in a separate browser tab and start playing it.',
        'Come back to CounterPoints and click "📺 Capture Video Audio".',
        'In the share dialog, pick the tab playing your show (Chrome: "Chrome Tab") and turn on "Also share tab audio".',
        'CounterPoints listens to that tab\'s audio, transcribes it live, and fact-checks as it goes — nothing is downloaded.',
      ],
    },
    {
      id: 'highlight',
      emoji: '📝',
      label: 'Highlight to fact-check',
      title: 'Highlight transcript to fact-check',
      blurb: 'Spot a claim yourself? Highlight any line in the transcript and send it straight to the fact-check engine.',
      youtubeId: 'BrcVdSgaLBc',
      steps: [
        'Paste a YouTube URL — captions auto-populate the CC tab with accurate timestamps.',
        'Claims found in captions are checked automatically and appear on the Auto tab.',
        'To check anything yourself: click the "⚡ Check" button on any transcript line, or highlight text → "Fact-check".',
        'Your manual checks live on the "Your Checks" tab; click a claim to jump to that moment in the video.',
      ],
    },
    {
      id: 'sources',
      emoji: '⚖',
      label: 'Live sources',
      title: 'Check live sources & fact-check sources',
      blurb: 'How a verdict is reached and how to read the full spectrum of sources behind it.',
      youtubeId: 'xebHovdesWw',
      steps: [
        'Each claim is researched across six lenses simultaneously — every side, not just one.',
        'The engine reconciles them into a verdict (TRUE / MISLEADING / FALSE / UNVERIFIED) + "the actual facts".',
        'The Counterpoint shows the single most important opposing fact, with its source.',
        'Tap any lens tab (Left, Right, Establishment, …) to read that perspective\'s sources and reliability score.',
      ],
    },
  ]

  const current = sections.find(s => s.id === active)!

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#0a0a0a]/95 backdrop-blur px-5 py-3 flex items-center gap-3">
        <Link href="/" className="text-sm font-semibold text-indigo-300 hover:text-white transition-colors">← CounterPoints</Link>
        <span className="text-white/20 select-none">|</span>
        <span className="text-xs text-gray-400">How to use</span>
        <div className="flex-1" />
        <Link href="/app" className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/30 transition-colors font-medium">
          Launch App →
        </Link>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-8 flex gap-8">

        {/* Sidebar nav — desktop */}
        <aside className="hidden lg:flex flex-col gap-1 w-48 shrink-0 sticky top-20 self-start">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3 px-2">Guides</p>
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`text-left px-3 py-2.5 rounded-xl text-sm transition-all ${
                active === s.id
                  ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className="mr-2">{s.emoji}</span>{s.label}
            </button>
          ))}
          <div className="mt-6 pt-4 border-t border-white/8">
            <Link href="/how-it-works" className="px-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors block">
              How it works (tech) →
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">

          {/* Hero blurb */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">How to use CounterPoints</h1>
            <p className="text-sm text-gray-400">Short guides for every way to fact-check. Start with the full walkthrough, then the specific how-tos.</p>
          </div>

          {/* Mobile pill nav */}
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  active === s.id
                    ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-200'
                    : 'border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>

          {/* Active section */}
          <section className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold mb-1">{current.title}</h2>
              <p className="text-sm text-gray-400 leading-relaxed">{current.blurb}</p>
            </div>

            {/* YouTube embed */}
            <div className="w-full rounded-2xl overflow-hidden border border-white/10 bg-black" style={{ aspectRatio: '16/9' }}>
              <iframe
                key={current.youtubeId}
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${current.youtubeId}`}
                title={current.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Steps */}
            <ol className="space-y-3 mt-2">
              {current.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-300 leading-relaxed">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[11px] flex items-center justify-center font-semibold">{i + 1}</span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            {/* Section nav arrows */}
            <div className="flex justify-between pt-6 border-t border-white/8">
              {sections.findIndex(s => s.id === active) > 0 ? (
                <button
                  onClick={() => setActive(sections[sections.findIndex(s => s.id === active) - 1].id)}
                  className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  ← {sections[sections.findIndex(s => s.id === active) - 1].label}
                </button>
              ) : <div />}
              {sections.findIndex(s => s.id === active) < sections.length - 1 ? (
                <button
                  onClick={() => setActive(sections[sections.findIndex(s => s.id === active) + 1].id)}
                  className="text-sm text-indigo-300 hover:text-white transition-colors flex items-center gap-1 ml-auto"
                >
                  {sections[sections.findIndex(s => s.id === active) + 1].label} →
                </button>
              ) : (
                <Link href="/app" className="text-sm font-medium text-indigo-300 hover:text-white transition-colors ml-auto">
                  Try it now →
                </Link>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
