'use client'
import { forwardRef } from 'react'

interface Props {
  videoId: string | null
  containerId: string
}

export const VideoPlayer = forwardRef<HTMLVideoElement, Props>(
  function VideoPlayer({ videoId, containerId }) {
    if (!videoId) {
      return (
        <div className="w-full aspect-video bg-black/40 rounded-xl flex items-center justify-center border border-white/5">
          <p className="text-gray-600 text-sm">Paste a YouTube URL above to load a video</p>
        </div>
      )
    }

    return (
      <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/5">
        <div id={containerId} className="w-full h-full" />
      </div>
    )
  }
)
