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
import { generateKeystrokes, countNetChars, countParagraphs, getSpeedMultiplier } from '../lib/humanize'
import type { WriteRequestBody, WriteJob, GoogleTokens } from '../types'

const router = Router()

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Run the write job entirely in the background — no dependency on the HTTP response
async function runWriteJob(job: WriteJob, tokens: GoogleTokens, user: PassportUser): Promise<void> {
  const auth = createOAuth2Client(tokens)

  auth.on('tokens', (newTokens) => {
    if (newTokens.access_token) user.accessToken = newTokens.access_token
  })

  try {
    const docs = createDocsClient(auth)
    let pendingBuffer = ''
    let consecutiveNewlines = 0

    async function flushIfNeeded(force = false): Promise<void> {
      const shouldFlush =
        force ||
        (pendingBuffer.endsWith('\n') && pendingBuffer.length >= 20) ||
        pendingBuffer.length >= 60
      if (!shouldFlush || !pendingBuffer) return
      await globalRateLimiter.acquire()
      job.cursorIndex = await doFlushBuffer(docs, job.docId, pendingBuffer, job.cursorIndex)
      pendingBuffer = ''
    }

    async function forceFlush(): Promise<void> {
      if (!pendingBuffer) return
      await globalRateLimiter.acquire()
      job.cursorIndex = await doFlushBuffer(docs, job.docId, pendingBuffer, job.cursorIndex)
      pendingBuffer = ''
    }

    // Regenerate keystrokes on the server from the stored params
    const events = (job as WriteJob & { _events: ReturnType<typeof generateKeystrokes> })._events

    for (const event of events) {
      const current = sessionStore.get(job.sessionId)
      if (!current || current.status === 'stopped') break

      while (current.status === 'paused') {
        await sleep(100)
        const j = sessionStore.get(job.sessionId)
        if (!j || j.status === 'stopped') break
      }
      if (!sessionStore.get(job.sessionId) || sessionStore.get(job.sessionId)!.status === 'stopped') break

      if (event.type === 'pause') {
        await forceFlush()
        await sleep(event.duration)
      } else if (event.type === 'insert') {
        await sleep(event.delay)
        pendingBuffer += event.char
        job.charsWritten++

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
        const elapsed = (Date.now() - job.startTime) / 60000
        job.cpm = elapsed > 0 ? Math.round(job.charsWritten / elapsed) : 0
      } else if (event.type === 'backspace') {
        await forceFlush()
        await sleep(event.delay)
        if (job.cursorIndex > 1) {
          await globalRateLimiter.acquire()
          await deleteChar(docs, job.docId, job.cursorIndex)
          job.cursorIndex--
          job.charsWritten = Math.max(0, job.charsWritten - 1)
        }
      }
    }

    await forceFlush()

    const finalJob = sessionStore.get(job.sessionId)
    if (finalJob && finalJob.status !== 'stopped') {
      finalJob.status = 'done'
      const elapsed = (Date.now() - job.startTime) / 60000
      finalJob.cpm = elapsed > 0 ? Math.round(finalJob.charsWritten / elapsed) : 0
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[write] Error:', message)
    const j = sessionStore.get(job.sessionId)
    if (j) {
      j.status = 'error'
      j.error = message
    }
  }
}

// POST /api/write — start a background write job, returns immediately
router.post('/write', async (req: Request, res: Response) => {
  const user = req.user as PassportUser | undefined
  if (!req.isAuthenticated() || !user?.accessToken) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  const body = req.body as WriteRequestBody
  const { sessionId, text, speed, humanness, docId: existingDocId } = body

  if (!sessionId || !text) {
    res.status(400).json({ error: 'Missing sessionId or text' })
    return
  }

  // Stop any existing job for this session
  if (sessionStore.has(sessionId)) {
    sessionStore.get(sessionId)!.status = 'stopped'
    sessionStore.delete(sessionId)
  }

  const tokens: GoogleTokens = {
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
  }

  try {
    const auth = createOAuth2Client(tokens)
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

    let cursorIndex = await getBodyEndIndex(auth, docId)
    if (cursorIndex === 0) cursorIndex = 1

    const speedMultiplier = getSpeedMultiplier(speed ?? 'normal')
    const events = generateKeystrokes(text, speedMultiplier, humanness ?? 65)
    const totalChars = countNetChars(events)
    const totalParagraphs = countParagraphs(text)

    const job: WriteJob & { _events: typeof events } = {
      sessionId,
      status: 'running',
      docId,
      docUrl,
      charsWritten: 0,
      totalChars,
      totalParagraphs,
      paragraphIndex: 1,
      startTime: Date.now(),
      cpm: 0,
      cursorIndex,
      _events: events,
    }

    sessionStore.set(sessionId, job)

    // Fire and forget — job runs independently of this HTTP connection
    runWriteJob(job, tokens, user).catch(err => {
      console.error('[write] Unhandled job error:', err)
    })

    res.json({ sessionId, docId, docUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[write] Setup error:', message)
    res.status(500).json({ error: message })
  }
})

// GET /api/status/:sessionId — poll for job progress
router.get('/status/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params
  const job = sessionStore.get(sessionId)

  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }

  res.json({
    status: job.status,
    docId: job.docId,
    docUrl: job.docUrl,
    charsWritten: job.charsWritten,
    totalChars: job.totalChars,
    paragraphIndex: job.paragraphIndex,
    totalParagraphs: job.totalParagraphs,
    cpm: job.cpm,
    error: job.error,
  })
})

// POST /api/pause
router.post('/pause', (req: Request, res: Response) => {
  const { sessionId } = req.body as { sessionId: string }
  const job = sessionStore.get(sessionId)
  if (!job) { res.status(404).json({ error: 'Session not found' }); return }
  job.status = 'paused'
  res.json({ ok: true })
})

// POST /api/resume
router.post('/resume', (req: Request, res: Response) => {
  const { sessionId } = req.body as { sessionId: string }
  const job = sessionStore.get(sessionId)
  if (!job) { res.status(404).json({ error: 'Session not found' }); return }
  job.status = 'running'
  res.json({ ok: true })
})

// POST /api/stop
router.post('/stop', (req: Request, res: Response) => {
  const { sessionId } = req.body as { sessionId: string }
  const job = sessionStore.get(sessionId)
  if (!job) { res.status(404).json({ error: 'Session not found' }); return }
  job.status = 'stopped'
  sessionStore.delete(sessionId)
  res.json({ ok: true })
})

export default router
