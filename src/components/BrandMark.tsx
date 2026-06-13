'use client'
import { motion } from 'framer-motion'

/**
 * CounterPoints brand graphic:
 * Red face (screaming left) → sound waves → CENTER face (eyes closed, ears open, headphones) ← sound waves ← Blue face (screaming right)
 */
export function BrandMark({ size = 200 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.42)}
      viewBox="0 0 480 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="redGlow">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="blueGlow">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ─── LEFT FACE (red, screaming RIGHT toward center) ─── */}
      <g filter="url(#redGlow)">
        {/* Head outline */}
        <ellipse cx="72" cy="95" rx="48" ry="58" fill="#1a0505" stroke="#ef4444" strokeWidth="1.5" />
        {/* Hair strokes */}
        {[-28,-18,-8,0,8,18,28].map((dx, i) => (
          <line key={i} x1={72+dx} y1="38" x2={72+dx} y2={30-Math.abs(dx)/4} stroke="#ef4444" strokeWidth="1.2" strokeOpacity="0.6" />
        ))}
        {/* Angry eyebrows — angled inward (furrow) */}
        <path d="M48 68 Q58 62 66 66" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M78 66 Q86 62 96 68" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Eyes — wide open, angry */}
        <ellipse cx="58" cy="78" rx="7" ry="8" fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeWidth="1" />
        <circle cx="58" cy="78" r="4" fill="#ef4444" fillOpacity="0.8" />
        <ellipse cx="86" cy="78" rx="7" ry="8" fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeWidth="1" />
        <circle cx="86" cy="78" r="4" fill="#ef4444" fillOpacity="0.8" />
        {/* Open screaming mouth — wide, showing teeth */}
        <path d="M50 108 Q72 130 94 108" stroke="#ef4444" strokeWidth="1.5" fill="#2a0808" />
        <path d="M50 108 Q72 118 94 108" fill="#ef4444" fillOpacity="0.2" stroke="none" />
        {/* Teeth */}
        {[56,64,72,80,88].map((x, i) => (
          <rect key={i} x={x-3} y="108" width="5" height="8" rx="1" fill="#ef4444" fillOpacity="0.5" />
        ))}
        {/* Neck + pointing finger toward center */}
        <rect x="60" y="150" width="24" height="18" rx="4" fill="#1a0505" stroke="#ef4444" strokeWidth="1" strokeOpacity="0.6" />
        {/* Finger pointing right */}
        <path d="M94 100 L130 95" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.7" />
        <circle cx="133" cy="95" r="4" fill="#ef4444" fillOpacity="0.7" />
      </g>

      {/* ─── RIGHT FACE (blue, screaming LEFT toward center) ─── */}
      <g filter="url(#blueGlow)">
        <ellipse cx="408" cy="95" rx="48" ry="58" fill="#030712" stroke="#3b82f6" strokeWidth="1.5" />
        {/* Hair */}
        {[-28,-18,-8,0,8,18,28].map((dx, i) => (
          <line key={i} x1={408+dx} y1="38" x2={408+dx} y2={30-Math.abs(dx)/4} stroke="#3b82f6" strokeWidth="1.2" strokeOpacity="0.6" />
        ))}
        {/* Angry brows */}
        <path d="M384 68 Q394 62 402 66" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M414 66 Q422 62 432 68" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Eyes */}
        <ellipse cx="394" cy="78" rx="7" ry="8" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1" />
        <circle cx="394" cy="78" r="4" fill="#3b82f6" fillOpacity="0.8" />
        <ellipse cx="422" cy="78" rx="7" ry="8" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1" />
        <circle cx="422" cy="78" r="4" fill="#3b82f6" fillOpacity="0.8" />
        {/* Screaming mouth */}
        <path d="M386 108 Q408 130 430 108" stroke="#3b82f6" strokeWidth="1.5" fill="#020c1e" />
        <path d="M386 108 Q408 118 430 108" fill="#3b82f6" fillOpacity="0.2" stroke="none" />
        {[392,400,408,416,424].map((x, i) => (
          <rect key={i} x={x-3} y="108" width="5" height="8" rx="1" fill="#3b82f6" fillOpacity="0.5" />
        ))}
        {/* Neck */}
        <rect x="396" y="150" width="24" height="18" rx="4" fill="#030712" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.6" />
        {/* Finger pointing left */}
        <path d="M386 100 L350 95" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.7" />
        <circle cx="347" cy="95" r="4" fill="#3b82f6" fillOpacity="0.7" />
      </g>

      {/* ─── SOUND WAVES (left → center) ─── */}
      {[0,1,2].map(i => (
        <motion.path
          key={`lw${i}`}
          d={`M${130 + i*16} ${78} Q${138 + i*16} 95 ${130 + i*16} 112`}
          stroke="#ef4444"
          strokeWidth={1.5 - i * 0.3}
          fill="none"
          strokeOpacity={0.7 - i * 0.2}
          strokeLinecap="round"
          animate={{ strokeOpacity: [0.7 - i*0.2, 0.2, 0.7 - i*0.2] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}

      {/* ─── SOUND WAVES (right → center) ─── */}
      {[0,1,2].map(i => (
        <motion.path
          key={`rw${i}`}
          d={`M${350 - i*16} ${78} Q${342 - i*16} 95 ${350 - i*16} 112`}
          stroke="#3b82f6"
          strokeWidth={1.5 - i * 0.3}
          fill="none"
          strokeOpacity={0.7 - i * 0.2}
          strokeLinecap="round"
          animate={{ strokeOpacity: [0.7 - i*0.2, 0.2, 0.7 - i*0.2] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}

      {/* ─── CENTER FACE (neutral, eyes closed, ears open, headphones) ─── */}
      <g filter="url(#softGlow)">
        {/* Glow ring */}
        <ellipse cx="240" cy="95" rx="52" ry="62" fill="#ffffff" fillOpacity="0.02" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* Head */}
        <ellipse cx="240" cy="95" rx="44" ry="54" fill="#111118" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        {/* Hair */}
        {[-24,-14,-4,6,16,24].map((dx, i) => (
          <line key={i} x1={240+dx} y1="42" x2={240+dx} y2={34-Math.abs(dx)/4} stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
        ))}
        {/* Eyes — gently closed (at peace) */}
        <path d="M220 80 Q228 76 236 80" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M244 80 Q252 76 260 80" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Slight lashes */}
        <line x1="222" y1="80" x2="221" y2="77" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        <line x1="258" y1="80" x2="259" y2="77" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        {/* Neutral slight-smile mouth */}
        <path d="M224 108 Q240 116 256 108" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Nose */}
        <path d="M237 90 Q235 98 238 102 Q242 104 244 102 Q247 98 243 90" stroke="rgba(255,255,255,0.25)" strokeWidth="1" fill="none" />
        {/* Neck */}
        <rect x="228" y="146" width="24" height="18" rx="4" fill="#111118" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

        {/* HEADPHONES — open ears on both sides */}
        {/* Left ear cup */}
        <path d="M196 78 Q188 90 188 105 Q188 120 196 128" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <rect x="186" y="88" width="12" height="28" rx="6" fill="#1a1a2e" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        {/* Left band */}
        <path d="M192 88 Q192 62 240 54" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" />
        {/* Right ear cup */}
        <path d="M284 78 Q292 90 292 105 Q292 120 284 128" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <rect x="282" y="88" width="12" height="28" rx="6" fill="#1a1a2e" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        {/* Right band */}
        <path d="M288 88 Q288 62 240 54" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" />
        {/* Top band center */}
        <path d="M240 54 Q240 48 240 46" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* Small sound-in indicators on ear cups (open/receiving) */}
        <motion.circle cx="192" cy="102" r="3" fill="#ef4444" fillOpacity="0.6"
          animate={{ fillOpacity: [0.6, 0.2, 0.6] }}
          transition={{ duration: 0.7, repeat: Infinity }}
        />
        <motion.circle cx="288" cy="102" r="3" fill="#3b82f6" fillOpacity="0.6"
          animate={{ fillOpacity: [0.6, 0.2, 0.6] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: 0.35 }}
        />
      </g>

      {/* ─── BRAND TEXT ─── */}
      <text x="240" y="190" textAnchor="middle" fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
        fontSize="11" fill="rgba(255,255,255,0.2)" letterSpacing="4" fontWeight="600">
        COUNTERPOINTS
      </text>
    </svg>
  )
}
