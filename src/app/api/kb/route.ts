/**
 * GET /api/kb          — knowledge base stats (total claims, topic breakdown, top sources)
 * GET /api/kb?search=X — semantic search: find the closest stored claim to query X
 * DELETE /api/kb?id=X  — remove a specific cached claim by Firestore doc ID
 */
import { NextRequest, NextResponse } from 'next/server'
import { getKbStats, findCachedClaim } from '@/lib/knowledge-base'

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get('search')

  if (search) {
    const result = await findCachedClaim(search, 'general')
    return NextResponse.json({ query: search, result })
  }

  try {
    const stats = await getKbStats()
    return NextResponse.json(stats)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    const { getDb } = await import('@/lib/firebase-admin')
    await getDb().collection('cp_claims').doc(id).delete()
    return NextResponse.json({ deleted: id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
