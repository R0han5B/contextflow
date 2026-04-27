import { NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/backend-config'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/cleanup`, {
      method: 'DELETE',
      cache: 'no-store',
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Proxy error in /api/documents/cleanup:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Cleanup failed',
      },
      { status: 502 }
    )
  }
}
