import { Router, Request, Response } from 'express'
import { createOAuth2Client, type PassportUser } from '../google/auth'
import {
  createDocsClient,
  createDocument,
  getBodyEndIndex,
  flushBuffer as doFlushBuffer,
  deleteChar,
} from '../google/docs'
import { globalRateLimiter } from '../lib/rateLimiter'
import { sessionStore } from '../lib/sessionStore'
import type { WriteRequestBody, WriteJob, KeystrokeEvent, GoogleTokens } from '../types'

const router = Router()

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function sendSSE(res: Response, data: object): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

/**
 * Count net characters inserted (insertions minus backspaces)
 */
function countTotalChars(events: KeystrokeEvent[]): number {
  let count = 0
  for (const e of events) {
    if (e.type === 'insert') count++
    else if (e.type === 'backspace') count--
  }
  return Math.max(0, count)
}

/**
 * Count paragraph breaks in the event stream
 */
function countParagraphBreaks(events: KeystrokeEvent[]): number {
  let doubleNewlines = 0
  let consecutiveNewlines = 0
  for (const e of events) {
    if (e.type === 'insert' && e.char === '\n') {
      consecutiveNewlines++
      if (consecutiveNewlines === 2) {
        doubleNewlines++
        consecutiveNewlines = 0
      }
    } else {
      consecutiveNewlines = 0
    }
  }
  return doubleNewlines + 1 // +1 for the first paragraph
}

// POST /api/write — start writing with SSE stream
router.post('/write', async (req: Request, res: Response) => {
  const user = req.user as PassportUser | undefined
  if (!req.isAuthenticated() || !user?.accessToken) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  const body = req.body as WriteRequestBody
  const { sessionId, events, docId: existingDocId } = body

  if (!sessionId || !events || !Array.isArray(events)) {
    res.status(400).json({ error: 'Missing sessionId or events' })
    return
  }

  // Kill any existing job for this session
  if (sessionStore.has(sessionId)) {
    const old = sessionStore.get(sessionId)!
    old.status = 'stopped'
    sessionStore.delete(sessionId)
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const tokens: GoogleTokens = {
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
  }
  const auth = createOAuth2Client(tokens)

  // Refresh tokens handler
  auth.on('tokens', (newTokens) => {
    if (newTokens.access_token) {
      (req.user as PassportUser).accessToken = newTokens.access_token
    }
  })

  try {
    // Create or use existing doc
    let docId: string
    let docUrl: string

    if (existingDocId) {
      docId = existingDocId
      docUrl = `https://docs.google.com/document/d/${docId}/edit`
    } else {
      const result = await createDocument(auth)
      docId = result.docId
      docUrl = result.docUrl
    }

    // Get starting cursor position
    let cursorIndex = await getBodyEndIndex(auth, docId)
    // For a fresh document, index 1 is where we start
    if (cursorIndex === 0) cursorIndex = 1

    const totalChars = countTotalChars(events)
    const totalParagraphs = countParagraphBreaks(events)

    const job: WriteJob = {
      sessionId,
      status: 'running',
      res,
      docId,
      cursorIndex,
      charsWritten: 0,
      totalChars,
      startTime: Date.now(),
      paragraphIndex: 1,
      totalParagraphs,
    }
    sessionStore.set(sessionId, job)

    sendSSE(res, { type: 'start', docId, docUrl })

    const docs = createDocsClient(auth)
    let pendingBuffer = ''
    let consecutiveNewlines = 0
    let lastProgressTime = Date.now()

    async function flushIfNeeded(force = false): Promise<void> {
      const shouldFlush =
        force ||
        pendingBuffer.endsWith(' ') ||
        pendingBuffer.endsWith('\n') ||
        pendingBuffer.length >= 8

      if (!shouldFlush || !pendingBuffer) return

      await globalRateLimiter.acquire()
      job.cursorIndex = await doFlushBuffer(docs, docId, pendingBuffer, job.cursorIndex)
      pendingBuffer = ''
    }

    async function forceFlush(): Promise<void> {
      if (!pendingBuffer) return
      await globalRateLimiter.acquire()
      job.cursorIndex = await doFlushBuffer(docs, docId, pendingBuffer, job.cursorIndex)
      pendingBuffer = ''
    }

    // Send progress at most every 500ms to avoid flooding
    function maybeSendProgress(): void {
      const now = Date.now()
      if (now - lastProgressTime < 500) return
      lastProgressTime = now
      const elapsed = (now - job.startTime) / 60000
      const cpm = elapsed > 0 ? Math.round(job.charsWritten / elapsed) : 0
      sendSSE(res, {
        type: 'progress',
        chars: job.charsWritten,
        total: job.totalChars,
        cpm,
        paragraph: job.paragraphIndex,
        totalParagraphs: job.totalParagraphs,
      })
    }

    // Main event replay loop
    for (const event of events) {
      // Check job status
      const currentJob = sessionStore.get(sessionId)
      if (!currentJob || currentJob.status === 'stopped') break

      // Handle pause
      while (currentJob.status === 'paused') {
        await sleep(100)
        const j = sessionStore.get(sessionId)
        if (!j || j.status === 'stopped') break
      }
      if (!sessionStore.get(sessionId) || sessionStore.get(sessionId)!.status === 'stopped') break

      if (event.type === 'pause') {
        await forceFlush()
        await sleep(event.duration)
      } else if (event.type === 'insert') {
        await sleep(event.delay)
        pendingBuffer += event.char
        job.charsWritten++

        // Track paragraphs
        if (event.char === '\n') {
          consecutiveNewlines++
          if (consecutiveNewlines === 2) {
            job.paragraphIndex++
            consecutiveNewlines = 0
          }
        } else {
          consecutiveNewlines = 0
        }

        await flushIfNeeded()
        maybeSendProgress()
      } else if (event.type === 'backspace') {
        // Flush buffer first, then delete
        await forceFlush()
        await sleep(event.delay)
        if (job.cursorIndex > 1) {
          await globalRateLimiter.acquire()
          await deleteChar(docs, docId, job.cursorIndex)
          job.cursorIndex--
          job.charsWritten = Math.max(0, job.charsWritten - 1)
        }
      }
    }

    // Final flush
    await forceFlush()

    const finalJob = sessionStore.get(sessionId)
    if (finalJob && finalJob.status !== 'stopped') {
      const elapsed = (Date.now() - job.startTime) / 60000
      const cpm = elapsed > 0 ? Math.round(job.charsWritten / elapsed) : 0
      sendSSE(res, {
        type: 'progress',
        chars: job.charsWritten,
        total: job.totalChars,
        cpm,
        paragraph: job.paragraphIndex,
        totalParagraphs: job.totalParagraphs,
      })
      sendSSE(res, { type: 'done', docUrl })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[write] Error:', message)
    sendSSE(res, { type: 'error', message })
  } finally {
    sessionStore.delete(sessionId)
    res.end()
  }
})

// POST /api/pause
router.post('/pause', (req: Request, res: Response) => {
  const { sessionId } = req.body as { sessionId: string }
  const job = sessionStore.get(sessionId)
  if (!job) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  job.status = 'paused'
  sendSSE(job.res, { type: 'paused', chars: job.charsWritten })
  res.json({ ok: true })
})

// POST /api/resume
router.post('/resume', (req: Request, res: Response) => {
  const { sessionId } = req.body as { sessionId: string }
  const job = sessionStore.get(sessionId)
  if (!job) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  job.status = 'running'
  sendSSE(job.res, { type: 'resumed', chars: job.charsWritten })
  res.json({ ok: true })
})

// POST /api/stop
router.post('/stop', (req: Request, res: Response) => {
  const { sessionId } = req.body as { sessionId: string }
  const job = sessionStore.get(sessionId)
  if (!job) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  sendSSE(job.res, { type: 'stopped', chars: job.charsWritten })
  job.status = 'stopped'
  sessionStore.delete(sessionId)
  res.json({ ok: true })
})

export default router
