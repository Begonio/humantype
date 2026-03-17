import type { SpeedPreset } from '../types'

const SPEED_PRESETS: { value: SpeedPreset; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
  { value: 'turbo', label: 'Turbo' },
]

interface ControlsProps {
  speed: SpeedPreset
  onSpeedChange: (speed: SpeedPreset) => void
  humanness: number
  onHumannessChange: (humanness: number) => void
  docId: string
  onDocIdChange: (docId: string) => void
  disabled: boolean
}

export function Controls({
  speed,
  onSpeedChange,
  humanness,
  onHumannessChange,
  docId,
  onDocIdChange,
  disabled,
}: ControlsProps) {
  const speedIndex = SPEED_PRESETS.findIndex(p => p.value === speed)

  return (
    <div className="controls">
      {/* Speed slider */}
      <div className="control-group">
        <label className="label">
          <span>Speed</span>
          <span className="accent">{SPEED_PRESETS[speedIndex]?.label}</span>
        </label>
        <input
          type="range"
          min={0}
          max={3}
          step={1}
          value={speedIndex}
          onChange={e => onSpeedChange(SPEED_PRESETS[Number(e.target.value)].value)}
          disabled={disabled}
          className="slider"
        />
        <div className="slider-labels">
          {SPEED_PRESETS.map(p => (
            <span key={p.value} className={p.value === speed ? 'active' : ''}>
              {p.label}
            </span>
          ))}
        </div>
      </div>

      {/* Humanness slider */}
      <div className="control-group">
        <label className="label">
          <span>Human-ness</span>
          <span className="accent">{humanness}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={humanness}
          onChange={e => onHumannessChange(Number(e.target.value))}
          disabled={disabled}
          className="slider"
        />
        <div className="slider-labels">
          <span>Robot</span>
          <span>Very Human</span>
        </div>
      </div>

      {/* Optional doc ID */}
      <div className="control-group">
        <label className="label">
          <span>Google Doc ID</span>
          <span className="label-meta dim">optional — leave blank to create new</span>
        </label>
        <input
          type="text"
          className="text-field"
          value={docId}
          onChange={e => onDocIdChange(e.target.value)}
          disabled={disabled}
          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
          spellCheck={false}
        />
      </div>
    </div>
  )
}
