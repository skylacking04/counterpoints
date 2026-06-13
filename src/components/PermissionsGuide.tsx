'use client'
import { useState } from 'react'
import Image from 'next/image'

interface Props {
  onClose: () => void
}

type OsTab = 'mac' | 'windows'
type BrowserTab = 'chrome' | 'brave'

export function PermissionsGuide({ onClose }: Props) {
  const [os, setOs] = useState<OsTab>('mac')
  const [browser, setBrowser] = useState<BrowserTab>('chrome')

  return (
    <div
      className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative bg-[#0d0d14] border border-white/10 rounded-2xl w-full max-w-2xl my-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <h2 className="text-sm font-semibold text-white">Audio Capture Setup</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Enable tab audio capture to fact-check any video in real time</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white text-lg leading-none p-1">✕</button>
        </div>

        {/* OS tabs */}
        <div className="flex border-b border-white/8">
          {(['mac', 'windows'] as const).map(t => (
            <button
              key={t}
              onClick={() => setOs(t)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                os === t ? 'text-white border-b-2 border-indigo-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'mac' ? '🍎 macOS' : '🪟 Windows'}
            </button>
          ))}
        </div>

        {/* Browser sub-tabs */}
        <div className="flex gap-2 px-5 pt-4">
          {(['chrome', 'brave'] as const).map(b => (
            <button
              key={b}
              onClick={() => setBrowser(b)}
              className={`text-[11px] px-3 py-1 rounded-full border transition-colors ${
                browser === b
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                  : 'border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'
              }`}
            >
              {b === 'chrome' ? 'Chrome / Arc' : 'Brave'}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Mac + Chrome */}
          {os === 'mac' && browser === 'chrome' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-white mb-2">Step 1 — Grant screen recording permission</h3>
                <ol className="space-y-1.5 text-[11px] text-gray-400 list-decimal list-inside leading-relaxed">
                  <li>Open <strong className="text-white">System Settings → Privacy &amp; Security → Screen &amp; System Audio Recording</strong></li>
                  <li>Find <strong className="text-white">Google Chrome</strong> (or Arc) in the list and toggle it <strong className="text-green-400">ON</strong></li>
                  <li>If prompted, restart Chrome</li>
                </ol>
                <div className="mt-3 rounded-xl overflow-hidden border border-white/8">
                  <Image
                    src="/permissions-mac.png"
                    alt="Mac Screen Recording permission settings"
                    width={640}
                    height={400}
                    className="w-full object-cover"
                  />
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white mb-2">Step 2 — Capture tab audio in CounterPoints</h3>
                <ol className="space-y-1.5 text-[11px] text-gray-400 list-decimal list-inside leading-relaxed">
                  <li>Open your YouTube video in a <strong className="text-white">separate Chrome tab</strong></li>
                  <li>In CounterPoints, click <strong className="text-white">📺 Capture Video Audio</strong></li>
                  <li>In the share dialog: select <strong className="text-white">"Chrome Tab"</strong></li>
                  <li>Pick the YouTube tab from the list</li>
                  <li>Check <strong className="text-white">"Also share tab audio"</strong> at the bottom</li>
                  <li>Click <strong className="text-white">Share</strong></li>
                </ol>
              </div>
            </div>
          )}

          {/* Mac + Brave */}
          {os === 'mac' && browser === 'brave' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-white mb-2">Step 1 — Grant screen recording permission</h3>
                <ol className="space-y-1.5 text-[11px] text-gray-400 list-decimal list-inside leading-relaxed">
                  <li>Open <strong className="text-white">System Settings → Privacy &amp; Security → Screen &amp; System Audio Recording</strong></li>
                  <li>Find <strong className="text-white">Brave Browser</strong> in the list and toggle it <strong className="text-green-400">ON</strong></li>
                  <li>If prompted, restart Brave</li>
                </ol>
                <div className="mt-3 rounded-xl overflow-hidden border border-white/8">
                  <Image
                    src="/permissions-mac.png"
                    alt="Mac Screen Recording permission settings"
                    width={640}
                    height={400}
                    className="w-full object-cover"
                  />
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white mb-2">Step 2 — Capture audio in CounterPoints</h3>
                <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
                  <p className="text-[11px] text-amber-300/80">Brave doesn&apos;t support Chrome Tab audio isolation. You&apos;ll share the full window&apos;s system audio instead.</p>
                </div>
                <ol className="space-y-1.5 text-[11px] text-gray-400 list-decimal list-inside leading-relaxed">
                  <li>Open YouTube in a Brave window</li>
                  <li>In CounterPoints, click <strong className="text-white">📺 Capture Video Audio</strong></li>
                  <li>In the share dialog: select <strong className="text-white">"Window"</strong></li>
                  <li>Pick the <strong className="text-white">Brave Browser</strong> window playing your video</li>
                  <li>Enable <strong className="text-white">"Also share system audio"</strong></li>
                  <li>Click <strong className="text-white">Share</strong></li>
                </ol>
              </div>
            </div>
          )}

          {/* Windows + Chrome */}
          {os === 'windows' && browser === 'chrome' && (
            <div className="space-y-4">
              <div className="bg-green-500/8 border border-green-500/20 rounded-lg px-3 py-2">
                <p className="text-[11px] text-green-300/80">Windows doesn&apos;t require any system permission for tab audio capture — you can start right away.</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white mb-2">Capture tab audio in CounterPoints</h3>
                <ol className="space-y-1.5 text-[11px] text-gray-400 list-decimal list-inside leading-relaxed">
                  <li>Open your YouTube video in a <strong className="text-white">separate Chrome tab</strong></li>
                  <li>In CounterPoints, click <strong className="text-white">📺 Capture Video Audio</strong></li>
                  <li>In the share dialog: select <strong className="text-white">"Chrome Tab"</strong></li>
                  <li>Pick the YouTube tab from the list</li>
                  <li>Check <strong className="text-white">"Also share tab audio"</strong> at the bottom</li>
                  <li>Click <strong className="text-white">Share</strong></li>
                </ol>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white mb-2">If audio isn&apos;t captured</h3>
                <ol className="space-y-1.5 text-[11px] text-gray-400 list-decimal list-inside leading-relaxed">
                  <li>Go to <strong className="text-white">chrome://settings/content/microphone</strong></li>
                  <li>Make sure CounterPoints is not in the blocked list</li>
                  <li>Also check <strong className="text-white">Windows Settings → System → Sound → Input</strong> — ensure your default input device is active</li>
                </ol>
              </div>
            </div>
          )}

          {/* Windows + Brave */}
          {os === 'windows' && browser === 'brave' && (
            <div className="space-y-4">
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
                <p className="text-[11px] text-amber-300/80">Brave on Windows uses system audio capture (Window mode) — no tab isolation, but it works reliably.</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white mb-2">Capture audio in CounterPoints</h3>
                <ol className="space-y-1.5 text-[11px] text-gray-400 list-decimal list-inside leading-relaxed">
                  <li>Open YouTube in a Brave window</li>
                  <li>In CounterPoints, click <strong className="text-white">📺 Capture Video Audio</strong></li>
                  <li>In the share dialog: select <strong className="text-white">"Window"</strong></li>
                  <li>Pick the <strong className="text-white">Brave Browser</strong> window playing your video</li>
                  <li>Enable <strong className="text-white">"Also share system audio"</strong></li>
                  <li>Click <strong className="text-white">Share</strong></li>
                </ol>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 pb-4 flex items-center justify-between">
          <p className="text-[10px] text-gray-600">Tip: keep the YouTube tab playing while CounterPoints is open in another tab</p>
          <button
            onClick={onClose}
            className="text-xs px-4 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
