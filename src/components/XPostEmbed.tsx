'use client'
import { useEffect, useRef } from 'react'
import type { XPostData } from '@/app/api/x-post/route'

declare global {
  interface Window {
    twttr?: { widgets: { load: (el?: HTMLElement) => void } }
  }
}

interface Props {
  post: XPostData
}

export function XPostEmbed({ post }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load Twitter widget script once
    const existing = document.getElementById('twitter-wjs')
    if (!existing) {
      const s = document.createElement('script')
      s.id = 'twitter-wjs'
      s.src = 'https://platform.twitter.com/widgets.js'
      s.async = true
      s.onload = () => window.twttr?.widgets.load(containerRef.current ?? undefined)
      document.body.appendChild(s)
    } else {
      // Script already loaded — just re-render this embed
      window.twttr?.widgets.load(containerRef.current ?? undefined)
    }
  }, [post.tweetId])

  return (
    <div className="rounded-xl overflow-hidden border border-white/8 bg-[#0d0d18] flex flex-col">
      {/* Header bar */}
      <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2 shrink-0">
        <span className="text-sm font-black text-white/80">𝕏</span>
        <span className="text-[11px] text-gray-400 font-medium">@{post.authorHandle}</span>
        <a
          href={`https://x.com/i/status/${post.tweetId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-[10px] text-indigo-400/70 hover:text-indigo-300 transition-colors"
        >
          Open on X ↗
        </a>
      </div>

      {/* Embedded tweet with native video player */}
      <div
        ref={containerRef}
        className="overflow-y-auto"
        style={{
          maxHeight: '380px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.15) transparent',
        }}
      >
        <blockquote
          className="twitter-tweet"
          data-theme="dark"
          data-dnt="true"
          data-conversation="none"
        >
          <a href={`https://twitter.com/i/status/${post.tweetId}`} />
        </blockquote>
      </div>

      {/* Tab Audio hint */}
      <div className="px-3 py-2 border-t border-white/5 flex items-center gap-2 text-[10px] text-amber-400/70 shrink-0">
        <span>📺</span>
        <span>Click <strong>Tab Audio</strong> above to capture what&apos;s playing in this video for real-time transcription</span>
      </div>
    </div>
  )
}
