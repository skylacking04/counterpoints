'use client'
import { useCallback, useRef, useState } from 'react'

interface UseAudioCaptureOptions {
  onTranscript: (text: string) => void
  onChunk?: (blob: Blob) => void  // fallback for Gemini transcription
  onError?: (msg: string) => void
}

export function useAudioCapture({ onTranscript, onChunk, onError }: UseAudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stoppedRef = useRef(false)

  // ~5s chunks: near-real-time, comfortably under Groq's free-tier req/min, good segment context.
  const CHUNK_MS = 5000

  const startMic = useCallback(async () => {
    // Browser-native Web Speech API — 100% free, no API cost
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition

    if (!SR) {
      console.warn('Web Speech API not available, falling back to tab capture')
      await startTabCapture()
      return
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const final = Array.from(e.results as ArrayLike<{ isFinal: boolean; [0]: { transcript: string } }>)
        .filter(r => r.isFinal)
        .map(r => r[0].transcript)
        .join(' ')
        .trim()
      if (final) onTranscript(final)
    }

    // Only restart on transient errors — not on 'aborted' (caused by stop())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'audio-capture' || e.error === 'network') {
        try { recognition.start() } catch { /* ignore if already started */ }
      }
    }
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        try { recognition.start() } catch { /* ignore race */ }
      }
    }

    recognition.start()
    setIsCapturing(true)
  }, [isCapturing, onTranscript])

  const startTabCapture = useCallback(async () => {
    // Tab audio capture → Gemini transcription (fallback, ~$0.0007/min)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: { echoCancellation: false, noiseSuppression: false, sampleRate: 16000 },
        video: { frameRate: { ideal: 1, max: 1 } },
      } as MediaStreamConstraints)
      // Chrome requires video: true to accept getDisplayMedia — drop it immediately
      stream.getVideoTracks().forEach(t => t.stop())

      // If the user picked a Window instead of a Tab, audio tracks are absent
      if (!stream.getAudioTracks().length) {
        stream.getTracks().forEach(t => t.stop())
        onError?.('No audio captured — Chrome: use "Chrome Tab" view → select your YouTube tab → enable "Also share tab audio" ON. Brave: Window view → "Also share system audio" ON.')
        return
      }

      streamRef.current = stream
      stoppedRef.current = false
      // Detect supported MIME type — Brave/Firefox may not support webm+opus
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
        .find(m => MediaRecorder.isTypeSupported(m))
      const recType = mimeType ?? 'audio/webm'

      // Stop/restart per cycle so every emitted blob is a COMPLETE file (with header).
      // MediaRecorder timeslice chunks share one header in the first chunk only — Whisper
      // can't decode the headerless fragments, so we record discrete clips instead.
      let chunks: Blob[] = []
      const newRecorder = () => {
        const r = new MediaRecorder(stream, mimeType ? { mimeType } : {})
        r.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
        r.onstop = () => {
          if (chunks.length && onChunk) { onChunk(new Blob(chunks, { type: recType })); chunks = [] }
          if (!stoppedRef.current && streamRef.current) {
            const next = newRecorder()
            mediaRef.current = next
            try { next.start() } catch { /* stream ended */ }
          }
        }
        return r
      }
      const recorder = newRecorder()
      mediaRef.current = recorder
      recorder.start()

      cycleRef.current = setInterval(() => {
        if (mediaRef.current?.state === 'recording') mediaRef.current.stop()  // → onstop flushes + restarts
      }, CHUNK_MS)

      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.onended = () => {
          stoppedRef.current = true
          if (cycleRef.current) clearInterval(cycleRef.current)
          if (mediaRef.current?.state === 'recording') mediaRef.current.stop()
          setIsCapturing(false)
        }
      }

      setIsCapturing(true)
    } catch (e) {
      console.error('Tab audio capture failed', e)
      let msg = 'Tab audio capture failed. Try again.'
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        msg = 'Screen share declined. Chrome: Chrome Tab → YouTube tab → "Also share tab audio" ON. Brave: Window → Brave window → "Also share system audio" ON. (Chrome may also need Screen Recording permission in macOS System Settings.)'
      }
      onError?.(msg)
    }
  }, [onChunk, onError])

  const stop = useCallback(() => {
    stoppedRef.current = true
    if (cycleRef.current) { clearInterval(cycleRef.current); cycleRef.current = null }
    recognitionRef.current?.stop()
    recognitionRef.current = null
    if (mediaRef.current?.state === 'recording') mediaRef.current.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setIsCapturing(false)
  }, [])

  return { isCapturing, startMic, startTabCapture, stop }
}
