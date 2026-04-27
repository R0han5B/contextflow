import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/backend-config'

export const runtime = 'nodejs'

const FALLBACK_ANALYSIS = {
  type: 'factual',
  complexity: 2,
  entities: [],
  chunksNeeded: 3,
  confidence: 50,
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const question = typeof body?.question === 'string' ? body.question : ''

    if (!question.trim()) {
      return NextResponse.json({ error: 'Invalid question' }, { status: 400 })
    }

    const response = await fetch(`${getBackendBaseUrl()}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
      cache: 'no-store',
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Proxy error in /api/analyze:', error)
    return NextResponse.json(FALLBACK_ANALYSIS)
  }
}
