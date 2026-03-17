import { useEffect, useReducer, useRef } from 'react'
import { TextInput } from './components/TextInput'
import { Controls } from './components/Controls'
import { Preview } from './components/Preview'
import { StatusBar } from './components/StatusBar'
import { ProgressBar } from './components/ProgressBar'
import { ActionButtons } from './components/ActionButtons'
import { generateKeystrokes, countParagraphs, getSpeedMultiplier } from './lib/humanize'
import { startWriteSession, sendControl, checkAuthStatus } from './lib/sse'
import type {
  AppStatus,
  KeystrokeEvent,
  ProgressState,
  SpeedPreset,
  SSEEvent,
} from './types'

interface AppState {
  status: AppStatus
  text: string
  speed: SpeedPreset
  humanness: number
  docId: string
  sessionId: string
  events: KeystrokeEvent[]
  progress: ProgressState | null
  docUrl: string | null
  error: string | null
  isAuthenticated: boolean
}

type AppAction =
  | { type: 'SET_TEXT'; text: string }
  | { type: 'SET_SPEED'; speed: SpeedPreset }
  | { type: 'SET_HUMANNESS'; humanness: number }
  | { type: 'SET_DOC_ID'; docId: string }
  | { type: 'SET_AUTH'; isAuthenticated: boolean }
  | { type: 'START'; sessionId: string; events: KeystrokeEvent[] }
  | { type: 'SSE_EVENT'; event: SSEEvent }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP' }
  | { type: 'RESET' }
  | { type: 'ERROR'; message: string }

function initialState(): AppState {
  return {
    status: 'idle',
    text: '',
    speed: 'normal',
    humanness: 65,
    docId: '',
    sessionId: '',
    events: [],
    progress: null,
    docUrl: null,
    error: null,
    isAuthenticated: false,
  }
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_TEXT':
      return { ...state, text: action.text, status: action.text ? 'ready' : 'idle' }
    case 'SET_SPEED':
      return { ...state, speed: action.speed }
    case 'SET_HUMANNESS':
      return { ...state, humanness: action.humanness }
    case 'SET_DOC_ID':
      return { ...state, docId: action.docId }
    case 'SET_AUTH':
      return { ...state, isAuthenticated: action.isAuthenticated }
    case 'START':
      return {
        ...state,
        status: 'writing',
        sessionId: action.sessionId,
        events: action.events,
        progress: null,
        docUrl: null,
        error: null,
      }
    case 'SSE_EVENT': {
      const e = action.event
      if (e.type === 'start') {
        return { ...state, docUrl: e.docUrl }
      }
      if (e.type === 'progress') {
        return {
          ...state,
          progress: {
            chars: e.chars,
            total: e.total,
            cpm: e.cpm,
            paragraph: e.paragraph,
            totalParagraphs: e.totalParagraphs,
          },
        }
      }
      if (e.type === 'done') {
        return { ...state, status: 'done', docUrl: e.docUrl }
      }
      if (e.type === 'paused') {
        return { ...state, status: 'paused' }
      }
      if (e.type === 'resumed') {
        return { ...state, status: 'writing' }
      }
      if (e.type === 'stopped') {
        return { ...state, status: 'idle' }
      }
      if (e.type === 'error') {
        return { ...state, status: 'error', error: e.message }
      }
      return state
    }
    case 'PAUSE':
      return { ...state, status: 'paused' }
    case 'RESUME':
      return { ...state, status: 'writing' }
    case 'STOP':
      return { ...state, status: 'idle' }
    case 'RESET':
      return { ...initialState(), isAuthenticated: state.isAuthenticated }
    case 'ERROR':
      return { ...state, status: 'error', error: action.message }
    default:
      return state
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const sseRef = useRef<{ abort: () => void } | null>(null)

  // Check auth on mount and after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('authed') || params.has('error')) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    checkAuthStatus().then(authenticated => {
      dispatch({ type: 'SET_AUTH', isAuthenticated: authenticated })
    })
  }, [])

  function handleSignIn() {
    window.location.href = '/api/auth/google'
  }

  async function handleStart() {
    if (!state.text.trim()) return

    const sessionId = crypto.randomUUID()
    const speedMultiplier = getSpeedMultiplier(state.speed)
    const events = generateKeystrokes(state.text, speedMultiplier, state.humanness)
    const totalParagraphs = countParagraphs(state.text)

    dispatch({ type: 'START', sessionId, events })

    const sse = startWriteSession(
      {
        sessionId,
        events,
        docId: state.docId.trim() || undefined,
        totalParagraphs,
      },
      (event: SSEEvent) => {
        dispatch({ type: 'SSE_EVENT', event })
      },
      () => {
        // Stream closed without done event
        sseRef.current = null
      },
      (err: Error) => {
        dispatch({ type: 'ERROR', message: err.message })
        sseRef.current = null
      }
    )

    sseRef.current = sse
  }

  async function handlePause() {
    await sendControl('pause', state.sessionId)
    dispatch({ type: 'PAUSE' })
  }

  async function handleResume() {
    await sendControl('resume', state.sessionId)
    dispatch({ type: 'RESUME' })
  }

  async function handleStop() {
    await sendControl('stop', state.sessionId)
    sseRef.current?.abort()
    sseRef.current = null
    dispatch({ type: 'STOP' })
  }

  function handleReset() {
    sseRef.current?.abort()
    sseRef.current = null
    dispatch({ type: 'RESET' })
  }

  const isWriting = state.status === 'writing'
  const isPaused = state.status === 'paused'
  const isStopped = state.status === 'idle' || state.status === 'done' || state.status === 'error'
  const isActive = isWriting || isPaused
  const inputDisabled = isActive

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">
          <span className="logo-ht">HT</span>
          <span className="logo-name">HumanType</span>
        </h1>
        <p className="tagline">Type like a human. Into Google Docs.</p>
      </header>

      <main className="main">
        <div className="left-panel">
          <TextInput
            value={state.text}
            onChange={text => dispatch({ type: 'SET_TEXT', text })}
            disabled={inputDisabled}
          />

          <Controls
            speed={state.speed}
            onSpeedChange={speed => dispatch({ type: 'SET_SPEED', speed })}
            humanness={state.humanness}
            onHumannessChange={humanness => dispatch({ type: 'SET_HUMANNESS', humanness })}
            docId={state.docId}
            onDocIdChange={docId => dispatch({ type: 'SET_DOC_ID', docId })}
            disabled={inputDisabled}
          />

          <ActionButtons
            status={state.status}
            isAuthenticated={state.isAuthenticated}
            hasText={state.text.trim().length > 0}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
            onSignIn={handleSignIn}
            onReset={handleReset}
          />
        </div>

        <div className="right-panel">
          <Preview
            events={state.events}
            isRunning={isWriting || isPaused}
            isPaused={isPaused}
            isStopped={isStopped}
          />

          <StatusBar
            status={state.status}
            progress={state.progress}
            docUrl={state.docUrl}
            error={state.error}
          />

          {state.progress && (
            <ProgressBar
              chars={state.progress.chars}
              total={state.progress.total}
            />
          )}
        </div>
      </main>
    </div>
  )
}
