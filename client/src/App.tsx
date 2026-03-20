import { useEffect, useReducer, useRef } from 'react'
import { TextInput } from './components/TextInput'
import { Controls } from './components/Controls'
import { Preview } from './components/Preview'
import { StatusBar } from './components/StatusBar'
import { ProgressBar } from './components/ProgressBar'
import { ActionButtons } from './components/ActionButtons'
import { generateKeystrokes, getSpeedMultiplier } from './lib/humanize'
import { startWriteJob, pollStatus, sendControl, checkAuthStatus } from './lib/api'
import type { AppStatus, KeystrokeEvent, ProgressState, SpeedPreset } from './types'

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
  | { type: 'SET_DOC_URL'; docUrl: string }
  | { type: 'SET_PROGRESS'; progress: ProgressState }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'DONE'; docUrl: string }
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
    case 'SET_DOC_URL':
      return { ...state, docUrl: action.docUrl }
    case 'SET_PROGRESS':
      return { ...state, progress: action.progress }
    case 'PAUSE':
      return { ...state, status: 'paused' }
    case 'RESUME':
      return { ...state, status: 'writing' }
    case 'DONE':
      return { ...state, status: 'done', docUrl: action.docUrl }
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  function startPolling(sessionId: string) {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const job = await pollStatus(sessionId)
        dispatch({
          type: 'SET_PROGRESS',
          progress: {
            chars: job.charsWritten,
            total: job.totalChars,
            cpm: job.cpm,
            paragraph: job.paragraphIndex,
            totalParagraphs: job.totalParagraphs,
          },
        })
        if (job.docUrl) dispatch({ type: 'SET_DOC_URL', docUrl: job.docUrl })

        if (job.status === 'done') {
          stopPolling()
          dispatch({ type: 'DONE', docUrl: job.docUrl })
        } else if (job.status === 'error') {
          stopPolling()
          dispatch({ type: 'ERROR', message: job.error ?? 'Unknown error' })
        } else if (job.status === 'stopped') {
          stopPolling()
          dispatch({ type: 'STOP' })
        } else if (job.status === 'paused') {
          dispatch({ type: 'PAUSE' })
        } else if (job.status === 'running') {
          dispatch({ type: 'RESUME' })
        }
      } catch {
        // Server unreachable — keep polling silently
      }
    }, 2000)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('authed') || params.has('error')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
    checkAuthStatus().then(authenticated => {
      dispatch({ type: 'SET_AUTH', isAuthenticated: authenticated })
    })
    return stopPolling
  }, [])

  function handleSignIn() {
    window.location.href = '/api/auth/google'
  }

  async function handleStart() {
    if (!state.text.trim()) return
    const sessionId = crypto.randomUUID()
    // Generate events client-side only for the live preview animation
    const events = generateKeystrokes(state.text, getSpeedMultiplier(state.speed), state.humanness)
    dispatch({ type: 'START', sessionId, events })

    try {
      const result = await startWriteJob({
        sessionId,
        text: state.text,
        speed: state.speed,
        humanness: state.humanness,
        docId: state.docId.trim() || undefined,
      })
      dispatch({ type: 'SET_DOC_URL', docUrl: result.docUrl })
      startPolling(sessionId)
    } catch (err) {
      dispatch({ type: 'ERROR', message: err instanceof Error ? err.message : 'Failed to start' })
    }
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
    stopPolling()
    dispatch({ type: 'STOP' })
  }

  function handleReset() {
    stopPolling()
    dispatch({ type: 'RESET' })
  }

  const isWriting = state.status === 'writing'
  const isPaused = state.status === 'paused'
  const isStopped = state.status === 'idle' || state.status === 'done' || state.status === 'error'
  const inputDisabled = isWriting || isPaused

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
