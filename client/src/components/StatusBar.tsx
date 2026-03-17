import type { ProgressState, AppStatus } from '../types'

interface StatusBarProps {
  status: AppStatus
  progress: ProgressState | null
  docUrl: string | null
  error: string | null
}

const STATUS_MESSAGES: Record<AppStatus, string> = {
  idle: 'Ready to type',
  ready: 'Ready — click Start Writing',
  writing: 'Writing...',
  paused: 'Paused',
  done: 'Done!',
  error: 'Error',
}

export function StatusBar({ status, progress, docUrl, error }: StatusBarProps) {
  const statusMsg = progress && status === 'writing'
    ? `Writing paragraph ${progress.paragraph} of ${progress.totalParagraphs}`
    : STATUS_MESSAGES[status]

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className={`status-text status-${status}`}>{statusMsg}</span>
        {error && <span className="error-text">{error}</span>}
      </div>
      <div className="status-right">
        {progress && (
          <span className="cpm-display">
            <span className="cpm-value">{progress.cpm}</span>
            <span className="cpm-label"> CPM</span>
          </span>
        )}
        {docUrl && status === 'done' && (
          <a
            href={docUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="doc-link"
          >
            Open Doc ↗
          </a>
        )}
      </div>
    </div>
  )
}
