import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, stat, copyFile, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// yt-dlp + ffmpeg pipeline. Both are CPU-only and installed in the Docker image.
// Optional proxy / cookies for when a Cloud Run IP hits YouTube's bot-check.
const YTDLP_PROXY   = process.env.YTDLP_PROXY   || ''
const YTDLP_COOKIES = process.env.YTDLP_COOKIES || ''  // path to a cookies.txt file (read-only secret mount)
// Player-client override. Default EMPTY = let yt-dlp choose, which uses the web cookies we
// supply. (Forcing mobile clients like android/ios makes them ignore web cookies → bot-check.)
// `tv` client + cookies is the combo that most often survives the datacenter-IP bot-check
// without a PO token. Override via YTDLP_PLAYER_CLIENT if needed.
const YT_PLAYER_CLIENT = process.env.YTDLP_PLAYER_CLIENT || 'tv'
const extractorArgs = (): string[] => YT_PLAYER_CLIENT ? ['--extractor-args', `youtube:player_client=${YT_PLAYER_CLIENT}`] : []

// yt-dlp writes the cookie jar back on exit, but the Secret Manager mount is READ-ONLY.
// Copy it once to a writable temp file and point yt-dlp there (also lets it persist
// refreshed session cookies across calls within this instance, extending their life).
let cookiesInit: Promise<string | null> | null = null
async function cookiesPath(): Promise<string | null> {
  if (!YTDLP_COOKIES) return null
  if (!cookiesInit) cookiesInit = (async () => {
    try {
      const dest = join(tmpdir(), 'cp-yt-cookies.txt')
      await copyFile(YTDLP_COOKIES, dest)
      await chmod(dest, 0o600)  // copyFile preserves the secret's 0444 mode; make it writable so yt-dlp can save back
      return dest
    } catch (e) { console.error('[audio-extract] cookie copy failed', e); return null }
  })()
  return cookiesInit
}

async function cookieArgs(): Promise<string[]> {
  const p = await cookiesPath()
  return p ? ['--cookies', p] : []
}

export interface ExtractResult {
  /** normalized 16kHz mono mp3 on disk */
  audioPath: string
  /** working dir to clean up when done */
  workDir: string
  durationMs: number
  meta: { title: string | null; uploader: string | null }
}

function run(cmd: string, args: string[], timeoutMs = 15 * 60 * 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = '', err = ''
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error(`${cmd} timed out`)) }, timeoutMs)
    p.stdout.on('data', d => { out += d })
    p.stderr.on('data', d => { err += d })
    p.on('error', e => { clearTimeout(timer); reject(e) })
    p.on('close', code => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      else reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`))
    })
  })
}

/** Download bestaudio from any URL and normalize to 16kHz mono mp3. */
export async function extractAudio(url: string): Promise<ExtractResult> {
  const workDir = await mkdtemp(join(tmpdir(), 'cp-audio-'))
  const rawTpl  = join(workDir, 'raw.%(ext)s')
  const rawMp3  = join(workDir, 'raw.mp3')
  const normMp3 = join(workDir, 'norm.mp3')

  const ytArgs = [
    '-f', 'bestaudio/best',
    '--no-playlist',
    '-x', '--audio-format', 'mp3', '--audio-quality', '5',
    '--print-json', '--no-progress', '--no-warnings',
    ...extractorArgs(),
    '-o', rawTpl,
  ]
  if (YTDLP_PROXY) ytArgs.push('--proxy', YTDLP_PROXY)
  ytArgs.push(...await cookieArgs())
  ytArgs.push(url)

  const ytOut = await run('yt-dlp', ytArgs, 10 * 60 * 1000)

  let meta: ExtractResult['meta'] = { title: null, uploader: null }
  let durationMs = 0
  try {
    const j = JSON.parse(ytOut.trim().split('\n').pop() || '{}') as { title?: string; uploader?: string; duration?: number }
    meta = { title: j.title ?? null, uploader: j.uploader ?? null }
    if (j.duration) durationMs = Math.round(j.duration * 1000)
  } catch { /* metadata best-effort */ }

  // Normalize for Whisper: 16kHz mono keeps files small (~0.5MB/min) and is what Whisper expects.
  await run('ffmpeg', ['-y', '-i', rawMp3, '-ar', '16000', '-ac', '1', '-b:a', '64k', normMp3], 10 * 60 * 1000)

  if (!durationMs) durationMs = await probeDurationMs(normMp3)
  return { audioPath: normMp3, workDir, durationMs, meta }
}

/** ffprobe the duration of a media file in ms. */
export async function probeDurationMs(path: string): Promise<number> {
  try {
    const out = await run('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', path,
    ], 60 * 1000)
    return Math.round(parseFloat(out.trim()) * 1000) || 0
  } catch { return 0 }
}

export interface AudioChunk { buffer: Buffer; startMs: number }

/**
 * Split a normalized mp3 into ≤ chunkSec slices, each re-encoded so its timeline
 * starts at 0. startMs = exact slice offset (index * chunkSec) so stitching is precise.
 */
export async function splitAudio(
  audioPath: string,
  durationMs: number,
  chunkSec = 600,
): Promise<AudioChunk[]> {
  const totalSec = Math.ceil(durationMs / 1000)
  if (totalSec <= chunkSec) {
    return [{ buffer: await readFile(audioPath), startMs: 0 }]
  }
  const chunks: AudioChunk[] = []
  for (let startSec = 0, i = 0; startSec < totalSec; startSec += chunkSec, i++) {
    const out = `${audioPath}.part${i}.mp3`
    // -ss before -i = fast accurate input seek; re-encode so each part is self-contained.
    await run('ffmpeg', [
      '-y', '-ss', String(startSec), '-t', String(chunkSec),
      '-i', audioPath, '-ar', '16000', '-ac', '1', '-b:a', '64k', out,
    ], 5 * 60 * 1000)
    try {
      if ((await stat(out)).size > 1000) chunks.push({ buffer: await readFile(out), startMs: startSec * 1000 })
    } catch { /* skip empty tail slice */ }
  }
  return chunks
}

export async function cleanup(workDir: string): Promise<void> {
  await rm(workDir, { recursive: true, force: true }).catch(() => {})
}

// ── Live-stream support ────────────────────────────────────────────────────────

async function ytCommonArgs(): Promise<string[]> {
  const a: string[] = ['--no-warnings', ...extractorArgs()]
  if (YTDLP_PROXY) a.push('--proxy', YTDLP_PROXY)
  a.push(...await cookieArgs())
  return a
}

/** True if the URL is an ongoing live broadcast. */
export async function isLiveUrl(url: string): Promise<boolean> {
  try {
    const out = await run('yt-dlp', [...await ytCommonArgs(), '--no-playlist', '--print', 'is_live', url], 60 * 1000)
    return out.trim().toLowerCase() === 'true'
  } catch { return false }
}

/** Resolve the direct media/HLS stream URL for a live (or any) source. */
export async function resolveStreamUrl(url: string): Promise<string> {
  // -f bestaudio first; fall back to best. -g prints the direct stream URL(s).
  const out = await run('yt-dlp', [...await ytCommonArgs(), '--no-playlist', '-f', 'bestaudio/best', '-g', url], 60 * 1000)
  const lines = out.trim().split('\n').filter(Boolean)
  if (!lines.length) throw new Error('no stream url resolved')
  return lines[lines.length - 1]  // last line = audio track when video+audio are separate
}

/**
 * Grab a window of audio from the LIVE EDGE of an HLS/stream URL and normalize to
 * 16kHz mono mp3. ffmpeg defaults to the live edge for HLS, so each call captures
 * roughly the next `seconds` of broadcast.
 */
export async function grabLiveWindow(streamUrl: string, seconds = 20): Promise<Buffer> {
  const workDir = await mkdtemp(join(tmpdir(), 'cp-live-'))
  const out = join(workDir, 'win.mp3')
  try {
    await run('ffmpeg', [
      '-y', '-i', streamUrl, '-t', String(seconds),
      '-ar', '16000', '-ac', '1', '-b:a', '64k', out,
    ], (seconds + 30) * 1000)
    return await readFile(out)
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}
