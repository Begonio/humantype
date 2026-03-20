import type { SpeedPreset } from '../types'

export interface StartWriteRequest {
  sessionId: string
  text: string
  speed: SpeedPreset
  humanness: number
  docId?: string
}

export interface JobStatusResponse {
  status: 'running' | 'paused' | 'stopped' | 'done' | 'error'
  docId: string
  docUrl: string
  charsWritten: number
  totalChars: number
  paragraphIndex: number
  totalParagraphs: number
  cpm: number
  error?: string
}

export async function startWriteJob(body: StartWriteRequest): Promise<{ docUrl: string }> {
  const res = await fetch('/api/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json() as Promise<{ docUrl: string }>
}

export async function pollStatus(sessionId: string): Promise<JobStatusResponse> {
  const res = await fetch(`/api/status/${sessionId}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<JobStatusResponse>
}

export async function sendControl(
  action: 'pause' | 'resume' | 'stop',
  sessionId: string
): Promise<void> {
  await fetch(`/api/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
    credentials: 'include',
  })
}

export async function checkAuthStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/status', { credentials: 'include' })
    if (!res.ok) return false
    const data = await res.json() as { authenticated: boolean }
    return data.authenticated
  } catch {
    return false
  }
}
