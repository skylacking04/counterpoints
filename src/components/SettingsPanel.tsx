'use client'
import { useEffect, useState } from 'react'
import type { LLMSettings, LLMProvider } from '@/types'

interface Props {
  settings: LLMSettings
  onChange: (s: LLMSettings) => void
  onClose: () => void
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail'

interface ProviderConfig {
  id: LLMProvider | 'groq'
  label: string
  description: string
  placeholder: string
  docsUrl: string
  keyField: keyof LLMSettings
  serverDefault?: string // shown when no user key — means our server key is used
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    description: 'Used for analysis, transcript, and search grounding.',
    placeholder: 'AIza...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    keyField: 'geminiKey',
    serverDefault: 'Server key active (your credits)',
  },
  {
    id: 'claude',
    label: 'Anthropic Claude',
    description: 'Optional fallback LLM provider.',
    placeholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    keyField: 'claudeKey',
  },
  {
    id: 'openai',
    label: 'OpenAI GPT-4o',
    description: 'Optional fallback LLM provider.',
    placeholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    keyField: 'openaiKey',
  },
  {
    id: 'grok',
    label: 'xAI Grok',
    description: 'Used for X Community Notes (primary source).',
    placeholder: 'xai-...',
    docsUrl: 'https://console.x.ai',
    keyField: 'grokKey',
    serverDefault: 'Server key active',
  },
  {
    id: 'groq',
    label: 'Groq (Whisper STT)',
    description: 'Used for live microphone speech transcription.',
    placeholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
    keyField: 'groqKey',
  },
]

function ProviderRow({
  config,
  value,
  activeProvider,
  onKeyChange,
  onSetActive,
}: {
  config: ProviderConfig
  value: string
  activeProvider: LLMProvider
  onKeyChange: (v: string) => void
  onSetActive: () => void
}) {
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<TestStatus>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const isActive = (config.id as string) === (activeProvider as string) && config.id !== 'groq'

  const testKey = async () => {
    if (!value.trim()) { setStatus('fail'); setStatusMsg('No key entered'); return }
    setStatus('testing')
    try {
      const res = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Key sent over HTTPS, not logged server-side, not stored
        body: JSON.stringify({ provider: config.id, apiKey: value.trim() }),
      })
      const data = await res.json() as { ok: boolean; message?: string; error?: string }
      if (data.ok) { setStatus('ok'); setStatusMsg(data.message ?? 'Connected') }
      else { setStatus('fail'); setStatusMsg(data.error ?? 'Invalid key') }
    } catch {
      setStatus('fail'); setStatusMsg('Connection error')
    }
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
      isActive ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-white/8 bg-white/2'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{config.label}</span>
            {isActive && (
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 rounded-full px-2 py-0.5 font-medium">Active LLM</span>
            )}
            {config.serverDefault && !value && (
              <span className="text-[10px] text-green-400/80">⬡ {config.serverDefault}</span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">{config.description}</p>
        </div>
        {config.id !== 'groq' && (
          <button
            onClick={onSetActive}
            disabled={isActive}
            className={`shrink-0 text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${
              isActive
                ? 'border-indigo-500/30 text-indigo-400 cursor-default'
                : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
            }`}
          >
            {isActive ? '✓ Active' : 'Set Active'}
          </button>
        )}
      </div>

      {/* Key input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={e => { onKeyChange(e.target.value); setStatus('idle') }}
            placeholder={config.serverDefault ? `Leave blank to use ${config.serverDefault}` : config.placeholder}
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 font-mono pr-16 focus:border-white/20 outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={() => setShow(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded"
          >
            {show ? 'hide' : 'show'}
          </button>
        </div>

        <button
          onClick={testKey}
          disabled={status === 'testing'}
          className="shrink-0 text-[11px] px-3 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {status === 'testing' ? (
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin" />
              Testing
            </span>
          ) : 'Test'}
        </button>
      </div>

      {/* Status message */}
      {status !== 'idle' && (
        <div className={`flex items-center gap-1.5 text-[11px] ${status === 'ok' ? 'text-green-400' : status === 'fail' ? 'text-red-400' : 'text-gray-400'}`}>
          {status === 'ok' ? '✓' : status === 'fail' ? '✗' : ''}
          {statusMsg}
        </div>
      )}

      <a
        href={config.docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[10px] text-gray-600 hover:text-blue-400 transition-colors"
      >
        Get API key ↗
      </a>
    </div>
  )
}

export function SettingsPanel({ settings, onChange, onClose }: Props) {
  const [local, setLocal]   = useState<LLMSettings>(settings)
  const [tab, setTab]       = useState<'keys' | 'privacy'>('keys')

  useEffect(() => {
    const saved = localStorage.getItem('cp_settings')
    if (saved) { try { setLocal(JSON.parse(saved)) } catch {} }
  }, [])

  const save = () => {
    localStorage.setItem('cp_settings', JSON.stringify(local))
    onChange(local)
    onClose()
  }

  const setKey = (field: keyof LLMSettings, value: string) =>
    setLocal(prev => ({ ...prev, [field]: value }))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#0f0f14] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-0">
          {(['keys', 'privacy'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${tab === t ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {t === 'keys' ? '🔑 API Keys' : '🔒 Privacy & Security'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>

          {tab === 'keys' && (
            <>
              <p className="text-[11px] text-gray-500 pb-1">
                Select your active LLM for analysis. Server keys are used by default — enter your own to use your credits.
              </p>
              {PROVIDERS.map(p => (
                <ProviderRow
                  key={p.id}
                  config={p}
                  value={(local[p.keyField] as string | undefined) ?? ''}
                  activeProvider={local.provider}
                  onKeyChange={v => setKey(p.keyField, v)}
                  onSetActive={() => setLocal(prev => ({ ...prev, provider: p.id as LLMProvider }))}
                />
              ))}
            </>
          )}

          {tab === 'privacy' && (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-2">
                <p className="font-semibold text-green-300">🔒 Your API Keys Are Safe</p>
                <ul className="space-y-1.5 text-[12px] text-gray-300 leading-relaxed">
                  <li>• Keys are stored only in your browser's <code className="bg-white/10 px-1 rounded text-[11px]">localStorage</code> — never on our servers</li>
                  <li>• When you click "Test", the key is sent over HTTPS to our test endpoint and immediately discarded — not logged, not stored</li>
                  <li>• When analyzing claims, only the claim text is sent to our server; your key is used only if you want to override billing to your account</li>
                  <li>• Our server-side keys (Gemini, Grok) are stored in GCP Secret Manager and never exposed to the client</li>
                  <li>• You can clear all saved keys by pressing "Clear All Keys" below</li>
                </ul>
              </div>

              <div className="rounded-xl border border-white/8 p-4 space-y-2">
                <p className="font-semibold text-white/80">What we analyze</p>
                <p className="text-[12px] text-gray-400 leading-relaxed">
                  Transcript text and claim text are sent to Gemini (Google) for analysis. No video data, no personal data, no browsing history. Verified claims are cached in our Firestore knowledge base (anonymously — no user ID attached).
                </p>
              </div>

              <button
                onClick={() => {
                  const keys: (keyof LLMSettings)[] = ['geminiKey', 'claudeKey', 'openaiKey', 'grokKey', 'groqKey', 'apiKey']
                  setLocal(prev => {
                    const next = { ...prev }
                    keys.forEach(k => delete next[k])
                    return next
                  })
                }}
                className="w-full py-2 rounded-lg border border-red-500/20 text-red-400 text-xs hover:bg-red-500/10 transition-colors"
              >
                🗑 Clear All Saved Keys
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-white/5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={save} className="flex-1 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/30 text-sm text-indigo-200 font-medium transition-colors">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
