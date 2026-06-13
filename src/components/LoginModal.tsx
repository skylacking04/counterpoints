'use client'
import { useState } from 'react'
import { KeyRound, X } from 'lucide-react'

interface Props {
  onClose: () => void
  onLoggedIn?: (email: string) => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Passwordless email login prompt. Reused in the top nav on every page.
export function LoginModal({ onClose, onLoggedIn }: Props) {
  const [email, setEmail]     = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const submit = async () => {
    const e = email.trim().toLowerCase()
    if (!EMAIL_RE.test(e)) { setError('Please enter a valid email address'); return }
    setError(null)
    setBusy(true)
    try {
      const currentId = typeof window !== 'undefined' ? (localStorage.getItem('cp_user_id') ?? '') : ''
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Pass current (possibly anon) id so prior anonymous work migrates to this email
        body: JSON.stringify({ email: e, mergeFromUserId: currentId }),
      })
      if (!res.ok) { setError('Sign-in failed, please try again'); setBusy(false); return }
      const { userId } = await res.json() as { userId: string }
      localStorage.setItem('cp_user_id', userId)
      localStorage.setItem('cp_user_email', e)
      onLoggedIn?.(e)
      onClose()
    } catch {
      setError('Sign-in failed, please try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
      onClick={ev => { if (ev.target === ev.currentTarget) onClose() }}
    >
      <div className="relative bg-[#0d0d14] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <button onClick={onClose} className="absolute top-3 right-4 text-gray-600 hover:text-white"><X size={18} /></button>
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 mb-3">
            <KeyRound size={20} />
          </div>
          <h2 className="text-base font-semibold text-white">Log in to CounterPoints</h2>
          <p className="text-xs text-gray-500 mt-1">Just your email — no password. Saves your videos &amp; fact-checks so you can pick up on any device.</p>
        </div>
        <input
          type="email"
          autoFocus
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="you@example.com"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-400/50 mb-3"
        />
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <button
          onClick={submit}
          disabled={busy}
          className="w-full py-2.5 rounded-lg bg-indigo-500/25 border border-indigo-500/40 text-indigo-100 text-sm font-medium hover:bg-indigo-500/35 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          Log in / Continue
        </button>
        <button onClick={onClose} className="w-full mt-2 py-1.5 text-xs text-gray-500 hover:text-gray-300">
          Continue without logging in
        </button>
      </div>
    </div>
  )
}
