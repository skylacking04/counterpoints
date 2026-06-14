// Fire-and-forget analytics. Never throws — tracking must never break the app.
export function track(
  event: string,
  opts: { page?: string; userId?: string; meta?: Record<string, string | number | boolean> } = {}
) {
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, ...opts }),
    }).catch(() => {})
  } catch { /* ignore */ }
}
