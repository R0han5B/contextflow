import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/backend-config'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const question = typeof body?.question === 'string' ? body.question : ''

    if (!question.trim()) {
      return NextResponse.json(
        {
          text: 'Please enter a question.',
          source: 'System',
        },
        { status: 400 }
      )
    }

    const response = await fetch(`${getBackendBaseUrl()}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        analysis: body?.analysis ?? null,
        documentIds: body?.documentIds ?? [],
      }),
      cache: 'no-store',
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Proxy error in /api/answer:', error)
    return NextResponse.json(
      {
        text: 'The Python backend is unavailable right now.',
        source: 'Error',
      },
      { status: 502 }
    )
  }
}
