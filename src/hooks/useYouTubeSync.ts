'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranscriptEntry } from '@/lib/youtube-transcript'

declare global {
  interface Window {
    YT: {
      Player: new (el: string | HTMLElement, opts: Record<string, unknown>) => YTPlayer
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
    }
    onYouTubeIframeAPIReady: () => void
  }
}

interface YTPlayer {
  getCurrentTime: () => number
  seekTo: (sec: number, allowSeek: boolean) => void
  destroy: () => void
}

export function useYouTubeSync(
  containerId: string,
  videoId: string | null,
  fullTranscript: TranscriptEntry[],
  onSyncLine: (line: string, offsetMs: number) => void,
  onPredictTopic: (upcomingText: string) => void,
  syncLines = true,
) {
  const playerRef     = useRef<YTPlayer | null>(null)
  const lastSyncedMs  = useRef(-1)
  const [currentSec, setCurrentSec] = useState(0)

  // Stable callback refs — interval never restarts due to prop identity changes
  const onSyncLineRef      = useRef(onSyncLine)
  const onPredictTopicRef  = useRef(onPredictTopic)
  onSyncLineRef.current     = onSyncLine
  onPredictTopicRef.current = onPredictTopic

  const loadAPI = useCallback(() => {
    if (window.YT) return
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  }, [])

  const initPlayer = useCallback((vid: string) => {
    if (!window.YT) {
      window.onYouTubeIframeAPIReady = () => initPlayer(vid)
      return
    }
    playerRef.current?.destroy()
    playerRef.current = new window.YT.Player(containerId, {
      videoId: vid,
      playerVars: { autoplay: 0, controls: 1, rel: 0 },
      events: { onStateChange: () => {} },
    })
  }, [containerId])

  // Poll currentTime every second — interval is stable (no callback deps)
  useEffect(() => {
    const interval = setInterval(() => {
      const sec = playerRef.current?.getCurrentTime() ?? 0
      setCurrentSec(sec)
      if (!syncLines || !fullTranscript.length) return

      const nowMs = Math.round(sec * 1000)
      const newLines = fullTranscript.filter(
        t => t.offsetMs > lastSyncedMs.current && t.offsetMs <= nowMs
      )
      for (const l of newLines) onSyncLineRef.current(l.text, l.offsetMs)
      if (newLines.length) lastSyncedMs.current = nowMs

      // Predictive: look 60s ahead
      const aheadStart = nowMs + 5_000
      const aheadEnd   = nowMs + 65_000
      const upcoming = fullTranscript
        .filter(t => t.offsetMs >= aheadStart && t.offsetMs <= aheadEnd)
        .map(t => t.text)
        .join(' ')
      if (upcoming.length > 50) onPredictTopicRef.current(upcoming)
    }, 1000)
    return () => clearInterval(interval)
  // syncLines is intentionally included so interval restarts if mode switches
  // fullTranscript included so interval restarts when transcript loads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullTranscript, syncLines])

  useEffect(() => {
    loadAPI()
  }, [loadAPI])

  useEffect(() => {
    if (videoId) initPlayer(videoId)
  }, [videoId, initPlayer])

  // Reset watermark when video changes
  useEffect(() => {
    lastSyncedMs.current = -1
    setCurrentSec(0)
  }, [videoId])

  const seekTo = useCallback((sec: number) => {
    playerRef.current?.seekTo(sec, true)
  }, [])

  return { currentSec, seekTo }
}
