import { GoogleGenAI } from '@google/genai'

// Primary: Vertex AI. On Cloud Run, ADC uses the attached service account — no API key needed.
// Vertex has tight per-minute quota; under heavy load it returns 429 RESOURCE_EXHAUSTED.
export const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GCLOUD_PROJECT ?? 'wandern-project-startup',
  location: 'us-central1',
})

// Fallback: Gemini Developer API — a SEPARATE quota pool (only used for transcripts otherwise).
// We route overflow here when Vertex is rate-limited so source-gathering + verdicts keep working.
export const devAi = process.env.GOOGLE_AI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY })
  : null
