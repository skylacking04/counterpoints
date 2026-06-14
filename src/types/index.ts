export type SpectrumLens = 'left' | 'center' | 'right' | 'alt' | 'grok' | 'establishment'

export type Verdict = 'TRUE' | 'MISLEADING' | 'FALSE' | 'UNVERIFIED'

// Open-ended topic category. `general` is the first-class catch-all for random/unexpected
// topics — it must NEVER fall back to political framing. Drives per-category source domains
// (source-db.ts) and the topic-adaptive lens UI.
export type TopicCategory =
  | 'political' | 'business' | 'finance' | 'tech' | 'science' | 'health'
  | 'history' | 'sports' | 'entertainment' | 'travel' | 'food' | 'environment'
  | 'world' | 'general'

export type StressLevel = 'calm' | 'elevated' | 'high'

export interface TranscriptLine {
  id: string
  text: string
  offsetMs: number       // ms from video start
  speaker?: string
  isClaim?: boolean
  claimId?: string
  source?: 'cc' | 'live' // 'cc' = YouTube captions, 'live' = tab-audio transcription
}

// ── Timestamped transcript (sync-test / transcription engine) ──────────────────
// Separate from TranscriptLine (the live /app rolling window) so /app stays untouched.
export interface TranscriptWord {
  w: string
  startMs: number
  endMs: number
}

export interface TranscriptSegment {
  startMs: number
  endMs: number
  text: string
  speaker?: string | null    // diarization label (e.g. "SPEAKER_00"); null until self-host phase
  words?: TranscriptWord[]
}

// Maps a diarization label → a resolved real name, e.g. { SPEAKER_00: "Joe Rogan" }
export type SpeakerMap = Record<string, string>

export type TranscriptSource = 'cc' | 'whisper'

export interface StoredTranscript {
  url: string
  videoId: string | null
  title: string | null
  durationMs: number
  audioUrl: string | null      // GCS download URL for native-element playback
  assetKey?: string            // shared base name mapping audio ↔ transcript (YYYYMMDD-slug-hash)
  audioObject?: string | null  // gs object path for the mp3
  transcriptObject?: string | null  // gs object path for the transcript JSON
  language?: string | null
  ccSegments: TranscriptSegment[]
  whisperSegments: TranscriptSegment[]
  speakerMap: SpeakerMap
  createdAt: number
}

// Lightweight per-user identity + history pointer (test-grade, no password)
export interface CpUser {
  userId: string
  email: string
  createdAt: number
  lastSeen: number
}

export interface HistoryEntry {
  urlHash: string
  url: string
  title: string | null
  assetKey?: string
  createdAt: number
}

// Persisted fact-check session — saved to Firestore, keyed by videoId + deviceId
export interface CpSession {
  sessionId: string
  userId: string
  videoId: string
  videoUrl: string
  videoTitle: string | null
  channelTitle: string | null
  createdAt: number
  updatedAt: number
  transcript: { text: string; offsetMs: number; durationMs: number }[]
  cards: CounterpointCard[]
}

export interface VoiceSnapshot {
  stressLevel: StressLevel
  pitchDelta: number     // % deviation from speaker baseline
  hesitationCount: number
  paceWpm: number
}

export interface VisionSnapshot {
  stressLevel: 'low' | 'medium' | 'high'
  signals: string[]
  confidence: number
}

export interface SpectrumItem {
  source: string
  url: string
  quote: string
  publishedDate?: string
  bias?: string
  allSidesRating?: string
  reliability?: number   // 1-5
  journalistNote?: string
  videoId?: string       // if YouTube clip
  videoTimestampSec?: number
  channelName?: string
  thumbnailUrl?: string
}

export interface CounterpointCard {
  id: string
  claimId: string
  claim: string
  verdict: Verdict
  verdictSummary: string
  middleGround?: string   // factual middle ground reconciling left vs right framing
  // The opposing/contextualizing fact — the namesake "counterpoint". e.g. claim "the rich should
  // pay more" → { question: "What share do the top 1% pay?", fact: "~40% of federal income tax" }
  counterpoint?: { question: string; fact: string; sourceName?: string; sourceUrl?: string }
  category?: TopicCategory // topic class driving the per-category sources + adaptive lens UI
  origin?: 'auto' | 'manual' // 'auto' = background scan; 'manual' = user clicked/highlighted. Drives the Main-vs-Auto-feed split. Undefined → treat as 'auto' (back-compat for older sessions).
  voiceSnapshot?: VoiceSnapshot | null
  visionSnapshot?: VisionSnapshot | null
  spectrum: Record<SpectrumLens, SpectrumItem[]>
  createdAt: number
  transcriptOffsetMs?: number  // where in the video this claim was spoken
  cacheHit?: boolean           // true if result was served from knowledge base
  cacheSimilarity?: number     // cosine similarity to the cached claim (0-1)
}

export interface Claim {
  id: string
  text: string
  topic: string
  category?: TopicCategory   // open-ended topic class (analyze route); defaults to 'general'
  confidence: number
  transcriptOffsetMs: number
}

export type LLMProvider = 'gemini' | 'claude' | 'openai' | 'grok'

export interface LLMSettings {
  provider: LLMProvider
  // Per-provider API keys stored in localStorage only, never sent to server
  geminiKey?: string
  claudeKey?: string
  openaiKey?: string
  grokKey?: string
  groqKey?: string
  // Legacy single-key field (deprecated, kept for backward compat)
  apiKey?: string
}

export function getProviderKey(settings: LLMSettings): string | undefined {
  switch (settings.provider) {
    case 'gemini': return settings.geminiKey ?? settings.apiKey
    case 'claude': return settings.claudeKey ?? settings.apiKey
    case 'openai': return settings.openaiKey ?? settings.apiKey
    case 'grok':   return settings.grokKey   ?? settings.apiKey
    default:       return settings.apiKey
  }
}

export interface SourceProfile {
  domain: string
  bias: 'left' | 'center' | 'right' | 'alt' | 'right-center' | 'left-center'
  reliability: number    // 1-5
  allSidesRating?: string
  label?: string
  establishment?: boolean  // institutional/consensus narrative source (Wikipedia, official fact-checkers, CDC/WHO)
}
