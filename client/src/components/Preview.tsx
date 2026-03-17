import { useEffect, useRef, useState } from 'react'
import type { KeystrokeEvent } from '../types'

interface PreviewProps {
  events: KeystrokeEvent[]
  isRunning: boolean
  isPaused: boolean
  isStopped: boolean
}

export function Preview({ events, isRunning, isPaused, isStopped }: PreviewProps) {
  const [displayText, setDisplayText] = useState('')
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const pausedAtRef = useRef<number>(0)
  const isPlayingRef = useRef(false)

  // Clear all pending timeouts
  function clearAll() {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }

  // Start/restart replay
  useEffect(() => {
    if (!isRunning || events.length === 0) return

    clearAll()
    setDisplayText('')
    isPlayingRef.current = true
    pausedAtRef.current = 0

    let accumulated = 0
    const textState = { value: '' }

    for (const event of events) {
      if (event.type === 'insert') {
        accumulated += event.delay
        const char = event.char
        const t = accumulated
        const id = setTimeout(() => {
          if (!isPlayingRef.current) return
          textState.value += char
          setDisplayText(textState.value)
        }, t)
        timeoutsRef.current.push(id)
      } else if (event.type === 'backspace') {
        accumulated += event.delay
        const t = accumulated
        const id = setTimeout(() => {
          if (!isPlayingRef.current) return
          textState.value = textState.value.slice(0, -1)
          setDisplayText(textState.value)
        }, t)
        timeoutsRef.current.push(id)
      } else if (event.type === 'pause') {
        accumulated += event.duration
      }
    }

    return () => {
      clearAll()
      isPlayingRef.current = false
    }
  }, [isRunning, events])

  // Stop replay
  useEffect(() => {
    if (isStopped) {
      clearAll()
      isPlayingRef.current = false
    }
  }, [isStopped])

  const showCursor = isRunning && !isStopped

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <span className="preview-label">Live Preview</span>
        {isRunning && !isPaused && <span className="status-dot running" />}
        {isPaused && <span className="status-dot paused" />}
      </div>
      <div className="preview-content">
        <pre className="preview-text">
          {displayText}
          {showCursor && <span className="cursor">▊</span>}
          {!isRunning && displayText.length === 0 && (
            <span className="preview-placeholder">Output will appear here...</span>
          )}
        </pre>
      </div>
    </div>
  )
}
