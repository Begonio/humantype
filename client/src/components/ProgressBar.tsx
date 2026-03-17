interface ProgressBarProps {
  chars: number
  total: number
}

export function ProgressBar({ chars, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.min(100, Math.round((chars / total) * 100)) : 0

  return (
    <div className="progress-bar-wrapper">
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="progress-pct">{pct}%</span>
    </div>
  )
}
