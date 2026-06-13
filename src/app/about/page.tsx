import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About Truth — CounterPoints',
  description: 'Why CounterPoints exists. On truthiness, perspective, Descartes, eyewitness testimony, and the need for balanced counter-evidence in the age of algorithmic bubbles.',
}

export default function About() {
  return (
    <div className="min-h-screen bg-[#070710] text-white">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-3 flex items-center justify-between">
        <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">← CounterPoints</Link>
        <Link
          href="/app"
          className="text-sm px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/30 transition-colors font-medium"
        >
          Launch App →
        </Link>
      </nav>

      <article className="max-w-3xl mx-auto px-6 py-16 space-y-24">

        {/* Hero */}
        <header className="text-center space-y-6">
          <h1 className="text-6xl sm:text-7xl font-bold tracking-tight">
            What is <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-blue-400">Truth</span>?
          </h1>
          <p className="text-2xl text-gray-400 max-w-xl mx-auto leading-relaxed">
            Beauty is in the eye of the beholder.<br />
            Today, <em>truth</em> is too.
          </p>
          <p className="text-sm text-gray-300">And that is a problem worth solving.</p>
        </header>

        {/* Truthiness */}
        <section className="space-y-6">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-3xl font-bold text-amber-300">Truthiness</h2>
            <span className="text-xs bg-amber-400/10 text-amber-400 border border-amber-400/20 px-3 py-1 rounded-full">
              Stephen Colbert, The Colbert Report, 2005
            </span>
          </div>
          <div className="space-y-4 text-lg text-gray-300 leading-relaxed">
            <p>
              The quality of <strong className="text-white">seeming true</strong> — not because evidence supports it, but because it <em>feels</em> true in your gut. Colbert coined the word satirically. Within two decades it became policy.
            </p>
            <p>
              We now live in an information ecosystem where people encounter thousands of claims per day — from politicians, podcasters, scientists, conspiracy theorists, and algorithms designed to keep us watching. The problem is no longer a lack of information. The problem is that <strong className="text-white">we can't tell the difference between a fact and a feeling</strong>.
            </p>
            <p className="text-gray-400">
              CounterPoints was built to restore that difference — not by telling you what to believe, but by showing you exactly what the evidence says and <em>who is saying it</em>.
            </p>
          </div>
        </section>

        {/* Same facts, different conclusions */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold">Same facts. Opposite conclusions.</h2>
          <div className="bg-white/3 border border-white/8 rounded-2xl p-8 space-y-6">
            <p className="text-lg text-gray-300 leading-relaxed">
              In a landmark "Many Analysts, One Dataset" study, researchers gave the exact same data to 29 independent scientific teams and asked a simple question. The teams reached <strong className="text-white">dramatically different conclusions</strong> — and their answers correlated strongly with their prior beliefs.
            </p>
            <div className="grid sm:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Same dataset. Team A saw:</p>
                <p className="text-green-400 text-lg font-medium">Positive effect ✓</p>
                <p className="text-xs text-gray-500">Selected variables that confirmed their hypothesis</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Same dataset. Team B saw:</p>
                <p className="text-red-400 text-lg font-medium">Negative effect ✗</p>
                <p className="text-xs text-gray-500">Selected different variables. Still peer-reviewed. Both wrong.</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 border-t border-white/5 pt-4">
              Science has a term for this: <em>researcher degrees of freedom</em>. Every analyst makes dozens of micro-decisions — which outliers to include, which controls to add, how to define the outcome — and each one nudges the result. This is not fraud. It is how human cognition works.
            </p>
          </div>
        </section>

        {/* Perspective vs. universal */}
        <section className="space-y-8">
          <h2 className="text-3xl font-bold">Is truth personal — or universal?</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 space-y-3">
              <h3 className="text-lg font-semibold text-red-300">The Subjectivist View</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                Truth is personal experience filtered through culture, emotion, and identity. What is true for you may not be true for me. My lived experience is valid. Your study doesn't overwrite my reality.
              </p>
              <p className="text-xs text-gray-500 italic">Common in postmodern discourse. Not always wrong.</p>
            </div>
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6 space-y-3">
              <h3 className="text-lg font-semibold text-blue-300">The Objectivist View</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                Some things are true independent of feeling. Water boils at 100°C whether or not you believe it. A building either stood on that date or it did not. Evidence, not gut feeling, determines what happened.
              </p>
              <p className="text-xs text-gray-500 italic">The basis of science and law. Also not always right.</p>
            </div>
          </div>
          <p className="text-gray-400 text-lg leading-relaxed">
            CounterPoints doesn't pick a side in this debate. It surfaces <strong className="text-white">both the evidence and its source's bias rating</strong>, so you can evaluate the objectivist claim through your own subjectivist lens. That's the only honest path.
          </p>
        </section>

        {/* I saw it with my own eyes */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold">"I saw it with my own eyes"</h2>
          <div className="space-y-5 text-gray-300 text-lg leading-relaxed">
            <p>
              Eye-witness testimony is one of the most powerful forms of evidence in a courtroom — and one of the least reliable. Studies consistently show that people confidently misremember color, timing, height, and sequence. Stress warps memory formation. Distance degrades detail. Suggestion contaminates recall weeks later.
            </p>
            <div className="border-l-4 border-amber-400 pl-6 space-y-2">
              <p className="text-amber-200 text-xl italic font-light">
                "The senses are not to be trusted."
              </p>
              <p className="text-sm text-gray-500">— René Descartes, <em>Meditations on First Philosophy</em>, 1641</p>
            </div>
            <p>
              Descartes proposed radical doubt — systematically questioning every belief, including perceptions, until reaching bedrock certainty. He found only one thing he couldn't doubt: <em className="text-white">the act of thinking itself</em>. Everything else — including what he saw, heard, and felt — could be mistaken.
            </p>
            <p className="text-gray-400">
              <strong className="text-white">Cogito, ergo sum.</strong> I think, therefore I am. But what I think I saw? That could easily be wrong. Which is why you need CounterPoints.
            </p>
          </div>
        </section>

        {/* Why now */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold">
            Why CounterPoints is needed <span className="text-red-400">right now</span>
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { title: 'Algorithmic bubbles', body: 'Every major platform shows you more of what you already agree with. Your reality is curated. You are being optimized for engagement, not understanding.' },
              { title: '24/7 media cycle', body: 'Speed rewards the confident and punishes the careful. Wrong information spreads faster than corrections. The retraction never reaches the same audience.' },
              { title: 'Trust collapse', body: 'Institutions, media, science, and government have all lost credibility simultaneously. People don\'t know who to believe — so they believe the loudest.' },
            ].map(c => (
              <div key={c.title} className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <h3 className="font-semibold text-white mb-2">{c.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
          <p className="text-xl text-gray-300 leading-relaxed">
            In this environment, the most dangerous thing isn't misinformation. It's the confident, well-produced, slightly wrong claim that makes it through every filter because it feels true to the people who share it.
          </p>
          <p className="text-gray-400 leading-relaxed">
            CounterPoints is a tool for people who want to know what's actually happening. Not what confirms their priors. Not what their algorithm selected. <strong className="text-white">What the evidence actually says — from every direction at once.</strong>
          </p>
        </section>

        {/* Closing */}
        <section className="text-center space-y-6 py-8">
          <div className="inline-flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl text-red-400 font-light">←</span>
              <span className="text-2xl font-bold text-white">You</span>
              <span className="text-4xl text-blue-400 font-light">→</span>
            </div>
            <p className="text-gray-500 text-sm max-w-sm">
              CounterPoints surfaces the facts.<br />
              You draw the conclusion.
            </p>
          </div>

          <Link
            href="/app"
            className="inline-block mt-6 px-10 py-4 rounded-2xl bg-gradient-to-r from-red-500/80 to-blue-500/80 hover:from-red-500 hover:to-blue-500 text-white font-semibold text-lg transition-all hover:scale-105"
          >
            Launch the App →
          </Link>
        </section>

        <footer className="border-t border-white/5 pt-8 text-center text-xs text-gray-300">
          CounterPoints is built for truth-seekers, not partisans. Built with Gemini, Grok, and a lot of epistemic humility.
        </footer>
      </article>
    </div>
  )
}
