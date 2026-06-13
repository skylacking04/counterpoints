import { createHash, randomUUID } from 'node:crypto'
import { getStorage } from 'firebase-admin/storage'
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app'

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? 'wandern-project-startup'
const BUCKET = process.env.GCS_BUCKET ?? 'wandern-project-startup.firebasestorage.app'
const PREFIX = 'counterpoints'

function app() {
  if (getApps().length > 0) return getApps()[0]
  return initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID, storageBucket: BUCKET })
}
const bucket = () => getStorage(app()).bucket(BUCKET)

export const sha1 = (s: string) => createHash('sha1').update(s).digest('hex')
export const short8 = (s: string) => sha1(s).slice(0, 8)

/** URL-safe, human-readable slug from a title (max ~40 chars). */
export function slug(title: string | null | undefined): string {
  return (title ?? 'audio')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
    .replace(/^-|-$/g, '') || 'audio'
}

/** Shared base name for the audio + transcript pair: YYYYMMDD-slug-shorthash. */
export function makeAssetKey(url: string, title: string | null | undefined, when = new Date()): string {
  const d = when.toISOString().slice(0, 10).replace(/-/g, '')
  return `${d}-${slug(title)}-${short8(url)}`
}

export const audioObject      = (assetKey: string) => `${PREFIX}/audio/${assetKey}.mp3`
export const transcriptObject = (assetKey: string) => `${PREFIX}/transcripts/${assetKey}.json`

// Firebase-style download URL minted from a token we set ourselves — works with plain object
// writes (storage.objectAdmin), avoiding the Firebase Storage API that getDownloadURL needs.
function downloadUrl(object: string, token: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(object)}?alt=media&token=${token}`
}

/** Upload the normalized mp3 from disk → returns its object path + a stable download URL. */
export async function uploadAudio(assetKey: string, localPath: string): Promise<{ object: string; url: string }> {
  const object = audioObject(assetKey)
  const token = randomUUID()
  await bucket().file(object).save(await (await import('node:fs/promises')).readFile(localPath), {
    contentType: 'audio/mpeg',
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=31536000',
      metadata: { firebaseStorageDownloadTokens: token },  // custom metadata → enables the token URL
    },
  })
  return { object, url: downloadUrl(object, token) }
}

/** Upload the self-describing transcript JSON → returns its object path. */
export async function uploadJson(assetKey: string, obj: unknown): Promise<{ object: string }> {
  const object = transcriptObject(assetKey)
  await bucket().file(object).save(JSON.stringify(obj, null, 2), {
    contentType: 'application/json',
    resumable: false,
  })
  return { object }
}
