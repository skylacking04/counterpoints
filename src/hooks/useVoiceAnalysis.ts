'use client'
import { useCallback, useRef, useState } from 'react'
import { detectPitch, getRMS, getZCR } from '@/lib/prosody'
import type { VoiceSnapshot, StressLevel } from '@/types'

interface Baseline {
  pitch: number
  rms: number
}

export function useVoiceAnalysis(stream: MediaStream | null) {
  const ctxRef      = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const baselineRef = useRef<Baseline | null>(null)
  const [snapshot, setSnapshot]     = useState<VoiceSnapshot | null>(null)
  const calibratingRef              = useRef(false)
  const calibrationSamplesRef       = useRef<{ pitch: number; rms: number }[]>([])

  const init = useCallback((mediaStream: MediaStream) => {
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    const source = ctx.createMediaStreamSource(mediaStream)
    source.connect(analyser)
    ctxRef.current = ctx
    analyserRef.current = analyser

    // Calibrate baseline over first 30 samples (~15s at 500ms intervals)
    calibratingRef.current = true
    calibrationSamplesRef.current = []
    const calibInterval = setInterval(() => {
      const buf = new Float32Array(analyser.fftSize)
      analyser.getFloatTimeDomainData(buf)
      calibrationSamplesRef.current.push({
        pitch: detectPitch(buf, ctx.sampleRate),
        rms:   getRMS(buf),
      })
      if (calibrationSamplesRef.current.length >= 30) {
        clearInterval(calibInterval)
        calibratingRef.current = false
        const valid = calibrationSamplesRef.current.filter(s => s.pitch > 0)
        baselineRef.current = {
          pitch: valid.length ? valid.reduce((a, b) => a + b.pitch, 0) / valid.length : 150,
          rms:   calibrationSamplesRef.current.reduce((a, b) => a + b.rms, 0) / calibrationSamplesRef.current.length,
        }
      }
    }, 500)
  }, [])

  const capture = useCallback((recentTranscript: string): VoiceSnapshot | null => {
    if (!analyserRef.current || !ctxRef.current) return null

    const buf = new Float32Array(analyserRef.current.fftSize)
    analyserRef.current.getFloatTimeDomainData(buf)

    const pitch = detectPitch(buf, ctxRef.current.sampleRate)
    const rms   = getRMS(buf)
    const zcr   = getZCR(buf)

    const baseline = baselineRef.current ?? { pitch: 150, rms: 0.05 }
    const pitchDelta = baseline.pitch > 0 ? ((pitch - baseline.pitch) / baseline.pitch) * 100 : 0

    // Count hesitations in transcript (60% of score)
    const fillers = (recentTranscript.match(/\b(um+|uh+|er+|ah+|like|you know|i mean)\b/gi) ?? []).length
    const transcriptStressScore = Math.min(fillers * 10, 40)

    // Pitch/RMS deviation (40% of score)
    const pitchStressScore = Math.min(Math.abs(pitchDelta) * 0.8, 30)
    const rmsStressScore = rms > baseline.rms * 1.3 ? 10 : 0

    const totalScore = transcriptStressScore + pitchStressScore + rmsStressScore

    let stressLevel: StressLevel = 'calm'
    if (totalScore >= 50) stressLevel = 'high'
    else if (totalScore >= 25) stressLevel = 'elevated'

    const snap: VoiceSnapshot = {
      stressLevel,
      pitchDelta: Math.round(pitchDelta),
      hesitationCount: fillers,
      paceWpm: 0, // calculated from timestamp diff in useTranscript
    }

    setSnapshot(snap)
    return snap
  }, [])

  const destroy = useCallback(() => {
    ctxRef.current?.close()
  }, [])

  return { snapshot, init, capture, destroy }
}
