import { NextRequest, NextResponse } from 'next/server'
import { getSessionByVideo } from '@/lib/sessions'

export const runtime = 'nodejs'

// GET ?videoId=...&userId=... — check if a video has been fact-checked before by this user
export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('videoId') ?? ''
  const userId  = req.nextUrl.searchParams.get('userId') ?? req.nextUrl.searchParams.get('deviceId') ?? ''
  if (!videoId || !userId) return NextResponse.json({ session: null })
  const session = await getSessionByVideo(videoId, userId)
  return NextResponse.json({ session })
}
