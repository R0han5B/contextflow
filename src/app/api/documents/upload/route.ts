import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/backend-config'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const incomingFormData = await request.formData()
    const file = incomingFormData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const outboundFormData = new FormData()
    const blob = new Blob([buffer], { type: file.type || 'application/octet-stream' })
    outboundFormData.append('file', blob, file.name)

    const response = await fetch(`${getBackendBaseUrl()}/upload`, {
      method: 'POST',
      body: outboundFormData,
      cache: 'no-store',
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Proxy error in /api/documents/upload:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 502 }
    )
  }
}
