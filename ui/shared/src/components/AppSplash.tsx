import { useEffect, useState } from 'react'
import './AppSplash.css'

const MESSAGES = [
  'Establishing secure connection...',
  'Loading trade configuration...',
  'Initializing IBKR bridge...',
  'Preparing dashboard...',
]

const UPDATE_MESSAGES = [
  'Update installed successfully...',
  'Verifying new version...',
  'Restoring your session...',
  'Almost ready...',
]

function EmbossedGear() {
  const cx = 110
  const cy = 110
  const n = 8
  const toothOrbit = 79
  const toothR = 15
  const ringOuter = 66
  const ringInner = 57
  const hubR = 28
  const centerR = 10
  const outerOrbit = 92

  const teeth = Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n - Math.PI / 2
    return { x: cx + toothOrbit * Math.cos(a), y: cy + toothOrbit * Math.sin(a) }
  })

  return (
    <svg viewBox="0 0 220 220" width="220" height="220" className="splash-gear-svg">
      <defs>
        <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1e88e5" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#1e88e5" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#64b5f6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#1e88e5" stopOpacity="0" />
        </radialGradient>
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="chartGlowS" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="chartLineS" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#42a5f5" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ffffff"  stopOpacity="1" />
        </linearGradient>
        <clipPath id="hubClipS">
          <circle cx={cx} cy={cy} r={hubR - 0.5} />
        </clipPath>
      </defs>

      {/* Outer dashed orbit ring — static, barely visible */}
      <circle
        cx={cx} cy={cy} r={outerOrbit}
        fill="none"
        stroke="rgba(100,181,246,0.07)"
        strokeWidth="0.6"
        strokeDasharray="5 10"
      />

      {/* Rotating gear group */}
      <g className="splash-gear-rotate" style={{ transformOrigin: `${cx}px ${cy}px` }}>

        {/* 8 tooth circles */}
        {teeth.map((t, i) => (
          <circle
            key={i}
            cx={t.x} cy={t.y} r={toothR}
            fill="rgba(6,14,26,0.92)"
            stroke="rgba(100,181,246,0.32)"
            strokeWidth="1.1"
          />
        ))}

        {/* Outer gear ring */}
        <circle
          cx={cx} cy={cy} r={ringOuter}
          fill="rgba(7,15,27,0.88)"
          stroke="rgba(100,181,246,0.30)"
          strokeWidth="1.4"
        />

        {/* Inner gear ring */}
        <circle
          cx={cx} cy={cy} r={ringInner}
          fill="none"
          stroke="rgba(30,136,229,0.18)"
          strokeWidth="0.8"
        />

        {/* Hub glow area */}
        <circle cx={cx} cy={cy} r={hubR * 1.6} fill="url(#hubGlow)" />

        {/* Hub ring */}
        <circle
          cx={cx} cy={cy} r={hubR}
          fill="rgba(6,14,26,0.95)"
          stroke="rgba(100,181,246,0.38)"
          strokeWidth="1.1"
          filter="url(#softGlow)"
        />

        {/* Hub chart content */}
        <g clipPath="url(#hubClipS)">
          {/* Subtle fill under chart */}
          <polygon
            points={`${cx - 28},${cy + 20} ${cx - 28},${cy + 13} ${cx - 19},${cy + 4} ${cx},${cy + 8} ${cx + 10},${cy - 5} ${cx + 17},${cy - 12} ${cx + 20},${cy + 20}`}
            fill="rgba(30,136,229,0.08)"
          />
          {/* Rising chart line */}
          <polyline
            points={`${cx - 28},${cy + 13} ${cx - 19},${cy + 4} ${cx},${cy + 8} ${cx + 10},${cy - 5} ${cx + 17},${cy - 12}`}
            fill="none"
            stroke="url(#chartLineS)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#chartGlowS)"
          />
          {/* Arrowhead */}
          <polyline
            points={`${cx + 13},${cy - 15} ${cx + 17},${cy - 12} ${cx + 14},${cy - 9}`}
            fill="none"
            stroke="white"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Tiny center dot */}
        <circle cx={cx} cy={cy} r={2.5} fill="rgba(100,181,246,0.5)" />
      </g>
    </svg>
  )
}

export default function AppSplash({ updateMode = false }: { updateMode?: boolean }) {
  const [msgIdx, setMsgIdx] = useState(0)
  const messages = updateMode ? UPDATE_MESSAGES : MESSAGES

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIdx((i) => (i + 1) % messages.length)
    }, 1300)
    return () => clearInterval(id)
  }, [messages.length])

  return (
    <div className="splash-root">
      {/* Subtle dot-grid background */}
      <div className="splash-grid" />

      <div className="splash-body">
        {/* Gear */}
        <div className="splash-gear-wrap">
          <EmbossedGear />
        </div>

        {/* Wordmark */}
        <div className="splash-wordmark">
          <span className="splash-word-trade">TRADE</span>
          <span className="splash-word-ops">OPS</span>
        </div>

        {/* Tagline */}
        <p className="splash-tagline">
          {updateMode ? 'Update Complete · Relaunching' : 'Professional Trade Automation'}
        </p>

        {/* Scanner loader */}
        <div className="splash-scanner-wrap">
          <div className="splash-scanner-track">
            <div className="splash-scanner-pulse" />
          </div>
        </div>

        {/* Rotating status message */}
        <p className="splash-status" key={msgIdx}>
          {messages[msgIdx]}
        </p>
      </div>

      <p className="splash-copyright">
        TradeOps &mdash; powered by IrfanA &copy;2026 &mdash; All Rights Reserved
      </p>
    </div>
  )
}
