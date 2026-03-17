interface TextInputProps {
  value: string
  onChange: (value: string) => void
  disabled: boolean
}

export function TextInput({ value, onChange, disabled }: TextInputProps) {
  const charCount = value.length
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0

  return (
    <div className="text-input-wrapper">
      <label className="label">
        <span>Paste your text</span>
        <span className="label-meta">{wordCount} words · {charCount} chars</span>
      </label>
      <textarea
        className="text-area"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Paste the text you want typed into a Google Doc..."
        spellCheck={false}
      />
      {charCount > 3000 && (
        <p className="warning">
          Large text ({charCount} chars) — writing will take a while at slower speeds.
        </p>
      )}
    </div>
  )
}
