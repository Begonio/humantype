export type KeystrokeEvent =
  | { type: 'insert'; char: string; delay: number }
  | { type: 'backspace'; delay: number }
  | { type: 'pause'; duration: number }

export type SpeedPreset = 'slow' | 'normal' | 'fast' | 'turbo'

export type JobStatus = 'running' | 'paused' | 'stopped' | 'done' | 'error'

export interface WriteJob {
  sessionId: string
  status: JobStatus
  docId: string
  docUrl: string
  charsWritten: number
  totalChars: number
  totalParagraphs: number
  paragraphIndex: number
  startTime: number
  cpm: number
  cursorIndex: number
  error?: string
}

export interface WriteRequestBody {
  sessionId: string
  text: string
  speed: SpeedPreset
  humanness: number
  docId?: string
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
