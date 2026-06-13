'use client'
import { useState, useEffect } from 'react'
import Link  from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { LogIn, User } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { LoginModal } from '@/components/LoginModal'

const FEATURES = [
  {
    icon: '🎧',
    title: 'Real-Time Listening',
    desc: 'Paste any YouTube URL or tap Live to capture audio. CounterPoints follows along word-by-word, in sync with the video.',
    color: 'border-sky-500/25 bg-sky-500/5',
    badge: 'bg-sky-500/15 text-sky-300',
  },
  {
    icon: '📜',
    title: 'Live Rolling Transcript',
    desc: "Every spoken word appears as it's said. Claims are highlighted and linked directly to the fact-check card that checked them.",
    color: 'border-violet-500/25 bg-violet-500/5',
    badge: 'bg-violet-500/15 text-violet-300',
  },
  {
    icon: '⚖',
    title: 'Balanced Fact-Checker',
    desc: 'Each claim is checked across Left, Center, Right, Alt, and X Community Notes — so you see every side, not just the one you agree with.',
    color: 'border-amber-500/25 bg-amber-500/5',
    badge: 'bg-amber-500/15 text-amber-300',
  },
]

// Demo video: set youtubeId OR drop /public/demo.mp4 (+ optional /public/demo-poster.png).
// Until an asset exists, a styled placeholder renders so the layout is ready.
const DEMO_VIDEO = { youtubeId: '', mp4: '/demo.mp4', poster: '/demo-poster.png' }

const HOW_STEPS = [
  { n: '1', t: 'Paste a YouTube URL', d: 'CounterPoints fetches the transcript in seconds — real captions via proxy, or Gemini video analysis as a fallback.', img: '/howto-1.png' },
  { n: '2', t: 'Claims auto-detected', d: 'Every 30 seconds, Gemini scans the transcript for factual claims (stats, history, science, politics) with confidence scoring.', img: '/howto-2.png' },
  { n: '3', t: 'Full spectrum checked', d: 'Each claim is simultaneously searched across Left, Center, Right, Alt media — plus X Community Notes via Grok. Parallel, <5 seconds.', img: '/howto-3.png' },
  { n: '4', t: 'Verdict + sources', d: 'A two-pass system delivers a verdict: TRUE / MISLEADING / FALSE / UNVERIFIED — with quoted sources from every side.', img: '/howto-4.png' },
  { n: '5', t: 'Learns over time', d: 'Every claim and verdict is stored in a knowledge base with semantic embeddings. Next time a similar claim appears, it answers instantly.', img: '/howto-5.png' },
]

const SPECTRUM = [
  { label: '𝕏 Community',  color: 'text-sky-300',    bg: 'bg-sky-500/10',    border: 'border-sky-500/25' },
  { label: 'Left',          color: 'text-blue-300',   bg: 'bg-blue-500/10',   border: 'border-blue-500/25' },
  { label: 'Center',        color: 'text-slate-300',  bg: 'bg-slate-500/10',  border: 'border-slate-500/25' },
  { label: 'Right',         color: 'text-red-300',    bg: 'bg-red-500/10',    border: 'border-red-500/25' },
  { label: 'Alt / Honest',  color: 'text-amber-300',  bg: 'bg-amber-500/10',  border: 'border-amber-500/25' },
  { label: '⚖ Full Picture',color: 'text-purple-300', bg: 'bg-purple-500/10', border: 'border-purple-500/25' },
]

// Demo video player — YouTube embed, local mp4, or placeholder (asset-driven)
function DemoVideo() {
  const [mp4Failed, setMp4Failed] = useState(false)
  if (DEMO_VIDEO.youtubeId) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-black" style={{ aspectRatio: '16/9' }}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${DEMO_VIDEO.youtubeId}`}
          title="CounterPoints demo"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }
  if (!mp4Failed) {
    return (
      <video
        className="w-full rounded-2xl border border-white/10 bg-black"
        style={{ aspectRatio: '16/9' }}
        controls
        playsInline
        poster={DEMO_VIDEO.poster}
        onError={() => setMp4Failed(true)}
      >
        <source src={DEMO_VIDEO.mp4} type="video/mp4" />
      </video>
    )
  }
  return (
    <div
      className="w-full rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] flex flex-col items-center justify-center gap-2 text-center"
      style={{ aspectRatio: '16/9' }}
    >
      <span className="text-4xl opacity-60">▶</span>
      <span className="text-sm text-gray-400 font-medium">Demo video coming soon</span>
      <span className="text-[11px] text-gray-600">A 60-second walkthrough of CounterPoints in action</span>
    </div>
  )
}

// Step screenshot with graceful fallback when the asset isn't present yet
function StepImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="w-full sm:w-44 shrink-0 rounded-xl border border-dashed border-white/10 bg-white/[0.02] flex items-center justify-center aspect-video">
        <span className="text-[10px] text-gray-600">screenshot</span>
      </div>
    )
  }
  // Plain img (not next/image) so a missing optional asset degrades gracefully via onError
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="w-full sm:w-44 shrink-0 rounded-xl border border-white/10 object-cover aspect-video"
    />
  )
}

export default function Home() {
  const [userEmail, setUserEmail]       = useState<string | null>(null)
  const [showLogin, setShowLogin]       = useState(false)

  useEffect(() => { setUserEmail(localStorage.getItem('cp_user_email')) }, [])

  return (
    <div className="min-h-screen bg-[#070710] text-white">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-2 flex items-center justify-between">
        <Image src="/counterpoints.png" alt="CounterPoints" width={200} height={133} className="h-24 w-auto" priority />
        <div className="flex items-center gap-3">
          <Link href="/about" className="text-xs text-gray-400 hover:text-white transition-colors hidden sm:block">About Truth</Link>
          {userEmail ? (
            <Link href="/history" className="flex items-center gap-1.5 text-xs text-indigo-300/80 hover:text-white border border-indigo-500/20 hover:border-white/20 rounded-xl px-3 py-2 transition-colors max-w-[180px]">
              <User size={14} className="shrink-0" /> <span className="truncate">{userEmail}</span>
            </Link>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-colors"
            >
              <LogIn size={15} /> Log in
            </button>
          )}
          <Link
            href="/app"
            className="text-sm px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/30 transition-colors font-medium"
          >
            Launch App →
          </Link>
        </div>
      </nav>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLoggedIn={setUserEmail} />}

      {/* Hero */}
      <section className="px-6 pt-16 pb-12 max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12">

          {/* Left: text + CTAs */}
          <motion.div
            className="flex-1 text-center lg:text-left"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block text-xs px-3 py-1.5 rounded-full border border-indigo-500/25 text-indigo-300 bg-indigo-500/10 mb-6">
              🔴 Real-time · AI-powered · Multi-source
            </span>

            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 leading-tight">
              Watch anything.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-amber-300 to-blue-400">
                See every side.
              </span>
            </h1>

            <p className="text-lg text-gray-400 max-w-xl mb-10 leading-relaxed">
              CounterPoints auto-detects factual claims from any YouTube video, fact-checks them across the full political spectrum, and shows you what every side thinks — in real time.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start items-center">
              <Link
                href="/app"
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-red-500/80 to-blue-500/80 hover:from-red-500 hover:to-blue-500 text-white font-semibold text-lg transition-all shadow-lg hover:shadow-xl hover:scale-105"
              >
                Launch CounterPoints →
              </Link>
              <Link
                href="/about"
                className="px-6 py-3 rounded-2xl border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-colors text-sm"
              >
                Why does this exist?
              </Link>
            </div>
          </motion.div>

          {/* Right: animated brand mark */}
          <motion.div
            className="shrink-0 flex flex-col items-center gap-4"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <BrandMark size={340} />
          </motion.div>
        </div>
      </section>

      {/* PNG logo — full brand mark */}
      <section className="flex justify-center pb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Image src="/counterpoints.png" alt="CounterPoints — Counter in blue, Points in red" width={480} height={320} className="w-full max-w-md mx-auto opacity-90 hover:opacity-100 transition-opacity" />
        </motion.div>
      </section>

      {/* Demo video */}
      <section className="px-6 pb-20 max-w-3xl mx-auto">
        <h2 className="text-center text-2xl font-semibold text-white/80 mb-6">See it in action</h2>
        <DemoVideo />
        <p className="text-center text-xs text-gray-500 mt-4">
          Want to capture audio from any tab?{' '}
          <Link href="/app" className="text-indigo-400/80 hover:text-indigo-300 underline">Open the app</Link>
          {' '}and click <span className="text-gray-400">“Setup guide →”</span> for Mac &amp; Windows steps.
        </p>
      </section>

      {/* 3 core features */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <h2 className="text-center text-2xl font-semibold text-white/80 mb-10">Three things it does right now</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
              className={`rounded-2xl border p-6 ${f.color}`}
            >
              <span className={`inline-block text-xl rounded-xl p-2 mb-3 ${f.badge}`}>{f.icon}</span>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Spectrum strip */}
      <section className="border-t border-b border-white/5 py-10 px-6 mb-20">
        <p className="text-center text-xs text-gray-500 uppercase tracking-widest mb-6">Sources from every lens</p>
        <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
          {SPECTRUM.map(s => (
            <span key={s.label} className={`text-xs px-3 py-1.5 rounded-full border font-medium ${s.color} ${s.bg} ${s.border}`}>
              {s.label}
            </span>
          ))}
        </div>
        <p className="text-center text-xs text-gray-600 mt-5 max-w-lg mx-auto">
          X Community Notes · Reuters · AP · Fox News · MSNBC · The Hill · Grayzone · Jimmy Dore · Sam Seder · Valuetainment · Wikipedia · PolitiFact and more
        </p>
      </section>

      {/* How to use */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <h2 className="text-center text-2xl font-semibold text-white/80 mb-10">How to use it</h2>
        <div className="space-y-5">
          {HOW_STEPS.map(step => (
            <div key={step.n} className="flex flex-col sm:flex-row gap-4 sm:items-center rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <StepImage src={step.img} alt={`Step ${step.n}: ${step.t}`} />
              <div className="flex gap-4 items-start flex-1">
                <span className="shrink-0 w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-sm font-bold flex items-center justify-center">{step.n}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{step.t}</p>
                  <p className="text-sm text-gray-400 mt-0.5">{step.d}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center pb-24 px-6">
        <h2 className="text-3xl font-bold mb-4">Ready to watch differently?</h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">Paste any YouTube URL and see the claims, the counter-evidence, and the full picture — instantly.</p>
        <Link
          href="/app"
          className="inline-block px-10 py-4 rounded-2xl bg-gradient-to-r from-red-500/80 to-blue-500/80 hover:from-red-500 hover:to-blue-500 text-white font-semibold text-lg transition-all shadow-lg hover:scale-105"
        >
          Open CounterPoints →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600 max-w-5xl mx-auto">
        <span>CounterPoints — built for truth-seekers, not partisans.</span>
        <div className="flex gap-6">
          <Link href="/app" className="hover:text-gray-400 transition-colors">App</Link>
          <Link href="/about" className="hover:text-gray-400 transition-colors">About</Link>
        </div>
      </footer>
    </div>
  )
}
