import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CounterPoints — Real-Time Fact-Check Companion',
  description: 'Live rolling transcript + balanced counterpoints from Left, Center, Right, Alt, and X Community Notes. Auto-detects claims and verifies them in real time.',
  keywords: ['fact check', 'real-time transcript', 'counterpoints', 'media bias', 'x community notes', 'youtube'],
  openGraph: {
    title: 'CounterPoints — Real-Time Fact-Check Companion',
    description: 'Live rolling transcript + balanced counterpoints. Watch any video with full context.',
    type: 'website',
    images: [{ url: '/counterpoints.png', width: 1536, height: 1024 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CounterPoints',
    description: 'Real-time fact-checker with Left / Center / Right / X Community Notes spectrum.',
    images: ['/counterpoints.png'],
  },
  icons: {
    icon: '/counterpoints.png',
    shortcut: '/counterpoints.png',
    apple: '/counterpoints.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-brand-dark antialiased">{children}</body>
    </html>
  )
}
