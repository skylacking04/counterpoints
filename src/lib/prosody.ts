// Client-side only — Web Audio API helpers

export interface ProsodyFeatures {
  pitchHz: number
  rms: number
  zcr: number
}

// Autocorrelation-based pitch detection from Float32Array
export function detectPitch(buffer: Float32Array, sampleRate: number): number {
  const size = buffer.length
  const maxLag = Math.floor(sampleRate / 80)  // min 80Hz
  const minLag = Math.floor(sampleRate / 500) // max 500Hz

  let bestCorr = -1
  let bestLag = -1

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0
    for (let i = 0; i < size - lag; i++) {
      corr += buffer[i] * buffer[i + lag]
    }
    corr /= size - lag
    if (corr > bestCorr) {
      bestCorr = corr
      bestLag = lag
    }
  }

  return bestLag > 0 && bestCorr > 0.01 ? sampleRate / bestLag : 0
}

export function getRMS(buffer: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i]
  return Math.sqrt(sum / buffer.length)
}

export function getZCR(buffer: Float32Array): number {
  let count = 0
  for (let i = 1; i < buffer.length; i++) {
    if ((buffer[i] >= 0) !== (buffer[i - 1] >= 0)) count++
  }
  return count / buffer.length
}

export function countHesitations(text: string): number {
  const fillers = /\b(um+|uh+|er+|ah+|like|you know|i mean|basically|literally|actually)\b/gi
  return (text.match(fillers) ?? []).length
}
