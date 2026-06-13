'use client'
import { useCallback, useRef } from 'react'

export function useFrameCapture(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const capture = useCallback((): string | null => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return null

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }
    const canvas = canvasRef.current
    canvas.width  = 320
    canvas.height = 180
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(video, 0, 0, 320, 180)
    return canvas.toDataURL('image/jpeg', 0.7)
  }, [videoRef])

  return { capture }
}
