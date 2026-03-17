import type { AppStatus } from '../types'

interface ActionButtonsProps {
  status: AppStatus
  isAuthenticated: boolean
  hasText: boolean
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onSignIn: () => void
  onReset: () => void
}

export function ActionButtons({
  status,
  isAuthenticated,
  hasText,
  onStart,
  onPause,
  onResume,
  onStop,
  onSignIn,
  onReset,
}: ActionButtonsProps) {
  if (!isAuthenticated) {
    return (
      <div className="action-buttons">
        <button className="btn btn-primary" onClick={onSignIn}>
          Sign in with Google
        </button>
        <p className="auth-hint">Required to write to Google Docs</p>
      </div>
    )
  }

  return (
    <div className="action-buttons">
      {(status === 'idle' || status === 'ready' || status === 'done' || status === 'error') && (
        <button
          className="btn btn-primary"
          onClick={onStart}
          disabled={!hasText}
        >
          {status === 'done' || status === 'error' ? 'Start Again' : 'Start Writing'}
        </button>
      )}

      {status === 'writing' && (
        <>
          <button className="btn btn-secondary" onClick={onPause}>
            Pause
          </button>
          <button className="btn btn-danger" onClick={onStop}>
            Stop
          </button>
        </>
      )}

      {status === 'paused' && (
        <>
          <button className="btn btn-primary" onClick={onResume}>
            Resume
          </button>
          <button className="btn btn-danger" onClick={onStop}>
            Stop
          </button>
        </>
      )}

      {(status === 'done' || status === 'error') && (
        <button className="btn btn-ghost" onClick={onReset}>
          Clear
        </button>
      )}
    </div>
  )
}
