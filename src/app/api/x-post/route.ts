import { NextRequest, NextResponse } from 'next/server'

export interface XPostData {
  tweetId: string
  text: string
  authorName: string
  authorHandle: string
  embedHtml: string
  videoUrl?: string
}

function extractTweetId(url: string): string | null {
  const m = url.match(/(?:twitter|x)\.com\/[^/]+\/status(?:es)?\/(\d+)/)
  return m?.[1] ?? null
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') ?? ''
  const id  = extractTweetId(url)
  if (!id) return NextResponse.json({ error: 'Invalid X/Twitter URL' }, { status: 400 })

  try {
    // Twitter oEmbed API — public, no auth required
    const oembedUrl = `https://publish.twitter.com/oembed?url=https://twitter.com/i/status/${id}&dnt=true&theme=dark&omit_script=true`
    const oRes = await fetch(oembedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })

    if (!oRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch tweet data', tweetId: id }, { status: 502 })
    }

    const data = await oRes.json() as {
      html?: string
      author_name?: string
      author_url?: string
    }

    // Extract plain text from the embed HTML
    const rawHtml  = data.html ?? ''
    const textBody = rawHtml
      .replace(/<a[^>]*>[^<]*<\/a>/g, '')  // strip links
      .replace(/<[^>]+>/g, ' ')            // strip all tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1000)

    const authorHandle = (data.author_url ?? '').split('/').pop() ?? 'unknown'

    return NextResponse.json({
      tweetId:     id,
      text:        textBody,
      authorName:  data.author_name ?? '',
      authorHandle,
      embedHtml:   rawHtml,
    } satisfies XPostData)
  } catch (e) {
    console.error('[x-post]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
