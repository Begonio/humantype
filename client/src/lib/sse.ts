import type { SSEEvent } from '../types'

/**
 * Start a write session via SSE (POST /api/write).
 * Uses fetch + ReadableStream since EventSource doesn't support POST bodies.
 *
 * @returns An object with an abort() method to cancel the stream.
 */
export function startWriteSession(
  body: object,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
  onError: (err: Error) => void
): { abort: () => void } {
  const controller = new AbortController()

  ;(async () => {
    try {
      const response = await fetch('/api/write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        credentials: 'include',
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`HTTP ${response.status}: ${text}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE events are separated by double newlines
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() ?? '' // keep last partial block

        for (const block of blocks) {
          const dataLine = block.split('\n').find(l => l.startsWith('data:'))
          if (!dataLine) continue
          const jsonStr = dataLine.slice(5).trim()
          if (!jsonStr) continue
          try {
            const event = JSON.parse(jsonStr) as SSEEvent
            onEvent(event)
          } catch {
            console.warn('[sse] Failed to parse event:', jsonStr)
          }
        }
      }

      onDone()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      onError(err instanceof Error ? err : new Error(String(err)))
    }
  })()

  return {
    abort: () => controller.abort(),
  }
}

/**
 * Send a control command (pause/resume/stop) to the server.
 */
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

/**
 * Check authentication status.
 */
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
