import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFile, writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { TranscriptEntry } from '@/lib/youtube-transcript'

const execFileAsync = promisify(execFile)

// Fetch captions via yt-dlp (uses mounted cookies, reliable from Cloud Run, ~3-10s).
// Server-only: depends on Node child_process + filesystem.
export async function fetchTranscriptViaYtDlp(videoId: string, opts: { noProxy?: boolean } = {}): Promise<TranscriptEntry[]> {
  const outTemplate = join(tmpdir(), `cp_${videoId}`)
  const cookiesPath = process.env.YTDLP_COOKIES
  const proxy = opts.noProxy ? undefined : process.env.PROXY_URL

  // yt-dlp writes refreshed cookies back to the file, but the secret mount is read-only
  // (and copyFile preserves that 0444 mode). Write a FRESH writable copy in /tmp.
  let cookiesArg: string | null = null
  if (cookiesPath) {
    const tmpCookies = join(tmpdir(), `cp_cookies_${videoId}.txt`)
    try {
      const content = await readFile(cookiesPath, 'utf-8')
      await writeFile(tmpCookies, content, { mode: 0o600 })
      cookiesArg = tmpCookies
    } catch (e) {
      console.error('[yt-dlp] cookie copy failed, proceeding without cookies:', (e as Error).message)
    }
  }

  const args = [
    '--write-subs',
    '--write-auto-subs',
    '--sub-format', 'json3',
    '--sub-langs', 'en',
    '--skip-download',
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout', '20',
    '-o', outTemplate,
  ]
  if (cookiesArg) args.push('--cookies', cookiesArg)
  if (proxy) args.push('--proxy', proxy)  // residential proxy → defeats datacenter-IP block
  args.push(`https://www.youtube.com/watch?v=${videoId}`)

  try {
    await execFileAsync('yt-dlp', args, { timeout: 25_000 })
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string; message?: string }
    // Log the TAIL of stderr — the real exception message is at the end of a Python traceback
    console.error('[yt-dlp] failed:', (err.stderr || err.message || '').slice(-600))
    if (cookiesArg) await unlink(cookiesArg).catch(() => {})
    return []
  }
  if (cookiesArg) await unlink(cookiesArg).catch(() => {})

  // Try manual subs first (higher quality), then auto-generated
  for (const ext of ['.en.json3', '.en-orig.json3']) {
    const filePath = outTemplate + ext
    try {
      const raw = await readFile(filePath, 'utf-8')
      await unlink(filePath).catch(() => {})
      const data = JSON.parse(raw) as {
        events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[]
      }
      const entries = (data.events ?? [])
        .filter(e => e.segs)
        .map(e => ({
          text:       (e.segs ?? []).map(s => s.utf8 ?? '').join('').replace(/\n/g, ' ').trim(),
          offsetMs:   e.tStartMs ?? 0,
          durationMs: e.dDurationMs ?? 0,
        }))
        .filter(e => e.text)
      if (entries.length > 0) {
        console.log(`[yt-dlp] fetched ${entries.length} entries for ${videoId} (${ext})`)
        return entries
      }
    } catch { /* try next */ }
  }
  return []
}
