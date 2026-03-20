export type KeystrokeEvent =
  | { type: 'insert'; char: string; delay: number }
  | { type: 'backspace'; delay: number }
  | { type: 'pause'; duration: number }

export type SpeedPreset = 'slow' | 'normal' | 'fast' | 'turbo'

export type AppStatus =
  | 'idle'
  | 'ready'
  | 'writing'
  | 'paused'
  | 'done'
  | 'error'

export interface ProgressState {
  chars: number
  total: number
  cpm: number
  paragraph: number
  totalParagraphs: number
}
