export type KeystrokeEvent =
  | { type: 'insert'; char: string; delay: number }
  | { type: 'backspace'; delay: number }
  | { type: 'pause'; duration: number }

export type SpeedPreset = 'slow' | 'normal' | 'fast' | 'turbo'

export const SPEED_MULTIPLIERS: Record<SpeedPreset, number> = {
  slow: 4,
  normal: 1,
  fast: 0.5,
  turbo: 0.25,
}

export type AppStatus =
  | 'idle'
  | 'ready'
  | 'writing'
  | 'paused'
  | 'done'
  | 'error'

export interface WriteRequest {
  sessionId: string
  events: KeystrokeEvent[]
  docId?: string
}

export interface SSEStartEvent {
  type: 'start'
  docId: string
  docUrl: string
}

export interface SSEProgressEvent {
  type: 'progress'
  chars: number
  total: number
  cpm: number
  paragraph: number
  totalParagraphs: number
}

export interface SSEDoneEvent {
  type: 'done'
  docUrl: string
}

export interface SSEErrorEvent {
  type: 'error'
  message: string
}

export interface SSEControlEvent {
  type: 'paused' | 'resumed' | 'stopped'
  chars: number
}

export type SSEEvent =
  | SSEStartEvent
  | SSEProgressEvent
  | SSEDoneEvent
  | SSEErrorEvent
  | SSEControlEvent

export interface ProgressState {
  chars: number
  total: number
  cpm: number
  paragraph: number
  totalParagraphs: number
}
