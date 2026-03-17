import type { Response } from 'express'

export type KeystrokeEvent =
  | { type: 'insert'; char: string; delay: number }
  | { type: 'backspace'; delay: number }
  | { type: 'pause'; duration: number }

export interface WriteJob {
  sessionId: string
  status: 'running' | 'paused' | 'stopped'
  res: Response
  docId: string
  cursorIndex: number
  charsWritten: number
  totalChars: number
  startTime: number
  paragraphIndex: number
  totalParagraphs: number
}

export interface WriteRequestBody {
  sessionId: string
  events: KeystrokeEvent[]
  docId?: string
  totalParagraphs?: number
}

export interface GoogleTokens {
  access_token?: string | null
  refresh_token?: string | null
  expiry_date?: number | null
  token_type?: string | null
  id_token?: string | null
  scope?: string
}

declare module 'express-session' {
  interface SessionData {
    tokens?: GoogleTokens
    userId?: string
  }
}
