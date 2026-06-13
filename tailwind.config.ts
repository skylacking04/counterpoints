import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          red:    '#e83b3b',
          yellow: '#f5a623',
          green:  '#27c47a',
          flame:  '#ff6b35',
          dark:   '#0a0a0a',
          panel:  '#111111',
          border: '#1e1e1e',
          muted:  '#888888',
        },
      },
      animation: {
        'flame-flicker': 'flicker 0.4s ease-in-out infinite alternate',
        'flash-red':     'flashRed 0.6s ease-out',
        'flash-yellow':  'flashYellow 0.6s ease-out',
        'flash-green':   'flashGreen 0.6s ease-out',
        'shake':         'shake 0.4s ease-in-out',
      },
      keyframes: {
        flicker: {
          '0%':   { opacity: '0.85', transform: 'scaleX(1)' },
          '100%': { opacity: '1',    transform: 'scaleX(1.05)' },
        },
        flashRed: {
          '0%':   { backgroundColor: 'rgba(232,59,59,0.4)' },
          '100%': { backgroundColor: 'transparent' },
        },
        flashYellow: {
          '0%':   { backgroundColor: 'rgba(245,166,35,0.3)' },
          '100%': { backgroundColor: 'transparent' },
        },
        flashGreen: {
          '0%':   { backgroundColor: 'rgba(39,196,122,0.3)' },
          '100%': { backgroundColor: 'transparent' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '25%':     { transform: 'translateX(-4px)' },
          '75%':     { transform: 'translateX(4px)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
