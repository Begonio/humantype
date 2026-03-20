import type { KeystrokeEvent } from '../types'

export type SpeedPreset = 'slow' | 'normal' | 'fast' | 'turbo'

const SPEED_MULTIPLIERS: Record<SpeedPreset, number> = {
  slow: 4,
  normal: 1,
  fast: 0.5,
  turbo: 0.25,
}

export function getSpeedMultiplier(preset: SpeedPreset): number {
  return SPEED_MULTIPLIERS[preset] ?? 1
}

const ADJACENCY: Record<string, string[]> = {
  q: ['w', 'a', 's'],
  w: ['q', 'e', 'a', 's', 'd'],
  e: ['w', 'r', 's', 'd', 'f'],
  r: ['e', 't', 'd', 'f', 'g'],
  t: ['r', 'y', 'f', 'g', 'h'],
  y: ['t', 'u', 'g', 'h', 'j'],
  u: ['y', 'i', 'h', 'j', 'k'],
  i: ['u', 'o', 'j', 'k', 'l'],
  o: ['i', 'p', 'k', 'l'],
  p: ['o', 'l'],
  a: ['q', 'w', 's', 'z'],
  s: ['a', 'w', 'e', 'd', 'z', 'x'],
  d: ['s', 'e', 'r', 'f', 'x', 'c'],
  f: ['d', 'r', 't', 'g', 'c', 'v'],
  g: ['f', 't', 'y', 'h', 'v', 'b'],
  h: ['g', 'y', 'u', 'j', 'b', 'n'],
  j: ['h', 'u', 'i', 'k', 'n', 'm'],
  k: ['j', 'i', 'o', 'l', 'm'],
  l: ['k', 'o', 'p'],
  z: ['a', 's', 'x'],
  x: ['z', 's', 'd', 'c'],
  c: ['x', 'd', 'f', 'v'],
  v: ['c', 'f', 'g', 'b'],
  b: ['v', 'g', 'h', 'n'],
  n: ['b', 'h', 'j', 'm'],
  m: ['n', 'j', 'k'],
}

const BURST_WORDS = new Set([
  'the', 'and', 'is', 'in', 'it', 'of', 'to', 'a', 'an', 'be',
  'was', 'are', 'for', 'on', 'at', 'by', 'or', 'as', 'he', 'she',
  'we', 'you', 'they', 'do', 'did', 'not', 'but', 'so', 'if',
  'this', 'that', 'with', 'from', 'has', 'had', 'have', 'will',
  'can', 'all', 'one', 'there', 'their', 'what', 'when', 'which',
  'i', 'my', 'me', 'no', 'up', 'go',
])

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function triangularRand(min: number, max: number): number {
  return Math.random() * (max - min) / 2 + Math.random() * (max - min) / 2 + min
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getAdjacentKey(char: string): string | null {
  const lower = char.toLowerCase()
  const neighbors = ADJACENCY[lower]
  if (!neighbors || neighbors.length === 0) return null
  return pickRandom(neighbors)
}

function isBurstWord(word: string): boolean {
  return BURST_WORDS.has(word.toLowerCase().replace(/[^a-z]/g, ''))
}

export function generateKeystrokes(
  text: string,
  speedMultiplier: number,
  humanness: number
): KeystrokeEvent[] {
  const events: KeystrokeEvent[] = []
  const typoChance = (humanness / 100) * 0.04
  const paragraphs = text.split(/\n\n/)

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const paragraph = paragraphs[pIdx]

    if (pIdx > 0) {
      events.push({ type: 'insert', char: '\n', delay: Math.round(triangularRand(40, 80) * speedMultiplier) })
      events.push({ type: 'insert', char: '\n', delay: Math.round(triangularRand(40, 80) * speedMultiplier) })
      const thinkMs = Math.max(8000, Math.round(rand(8000, 15000) * speedMultiplier))
      events.push({ type: 'pause', duration: thinkMs })
    }

    const lines = paragraph.split('\n')

    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const line = lines[lIdx]

      if (lIdx > 0) {
        events.push({ type: 'insert', char: '\n', delay: Math.round(triangularRand(40, 80) * speedMultiplier) })
        events.push({ type: 'pause', duration: Math.round(rand(300, 700) * speedMultiplier) })
      }

      const words = line.split(' ')

      for (let wIdx = 0; wIdx < words.length; wIdx++) {
        const word = words[wIdx]
        if (word.length === 0) {
          events.push({ type: 'insert', char: ' ', delay: Math.round(triangularRand(20, 60) * speedMultiplier) })
          continue
        }

        const burstMultiplier = isBurstWord(word) ? 0.65 : 1.0

        for (let cIdx = 0; cIdx < word.length; cIdx++) {
          const char = word[cIdx]
          let baseDelay = Math.round(triangularRand(40, 120) * speedMultiplier * burstMultiplier)
          if (char >= 'A' && char <= 'Z') baseDelay = Math.round(baseDelay * 1.2)
          if (char >= '0' && char <= '9') baseDelay = Math.round(baseDelay * 1.15)

          if (humanness > 50 && cIdx > 0 && cIdx < word.length - 1) {
            const hesitanceChance = ((humanness - 50) / 50) * 0.008
            if (Math.random() < hesitanceChance) {
              events.push({ type: 'pause', duration: Math.round(rand(300, 800) * speedMultiplier) })
            }
          }

          const charLower = char.toLowerCase()
          if (
            Math.random() < typoChance &&
            ADJACENCY[charLower] &&
            !(cIdx === 0 && wIdx === 0 && pIdx === 0)
          ) {
            const wrongKey = getAdjacentKey(char)
            if (wrongKey) {
              const wrongChar = char >= 'A' && char <= 'Z' ? wrongKey.toUpperCase() : wrongKey
              events.push({ type: 'insert', char: wrongChar, delay: baseDelay })

              const extraCount = Math.random() < 0.2 ? Math.floor(rand(1, 3)) : 0
              for (let e = 0; e < extraCount; e++) {
                const nextIdx = cIdx + 1 + e
                if (nextIdx < word.length) {
                  events.push({
                    type: 'insert',
                    char: word[nextIdx],
                    delay: Math.round(triangularRand(40, 100) * speedMultiplier * burstMultiplier),
                  })
                }
              }

              events.push({ type: 'pause', duration: Math.round(rand(80, 250) * speedMultiplier) })
              for (let e = extraCount; e >= 0; e--) {
                events.push({ type: 'backspace', delay: Math.round(rand(60, 130) * speedMultiplier) })
              }
              events.push({ type: 'insert', char, delay: Math.round(triangularRand(50, 100) * speedMultiplier) })
              continue
            }
          }

          events.push({ type: 'insert', char, delay: baseDelay })
        }

        if (wIdx < words.length - 1) {
          const lastChar = word[word.length - 1]
          let punctuationPause = 0
          if (lastChar === ',' || lastChar === ';') {
            punctuationPause = Math.round(rand(800, 1800) * speedMultiplier)
          } else if (lastChar === '.' || lastChar === '!' || lastChar === '?') {
            punctuationPause = Math.max(4000, Math.round(rand(4000, 8000) * speedMultiplier))
          } else if (lastChar === ':') {
            punctuationPause = Math.round(rand(600, 1200) * speedMultiplier)
          }
          events.push({ type: 'insert', char: ' ', delay: Math.round(triangularRand(20, 80) * speedMultiplier) })
          if (punctuationPause > 0) events.push({ type: 'pause', duration: punctuationPause })
        }
      }

      if (words.length > 0) {
        const lastWord = words[words.length - 1]
        if (lastWord.length > 0) {
          const lastChar = lastWord[lastWord.length - 1]
          let punctuationPause = 0
          if (lastChar === '.' || lastChar === '!' || lastChar === '?') {
            punctuationPause = Math.max(4000, Math.round(rand(4000, 8000) * speedMultiplier))
          } else if (lastChar === ',' || lastChar === ';') {
            punctuationPause = Math.round(rand(800, 1800) * speedMultiplier)
          }
          if (punctuationPause > 0) events.push({ type: 'pause', duration: punctuationPause })
        }
      }
    }
  }

  return events
}

export function countNetChars(events: KeystrokeEvent[]): number {
  let count = 0
  for (const e of events) {
    if (e.type === 'insert') count++
    else if (e.type === 'backspace') count--
  }
  return Math.max(0, count)
}

export function countParagraphs(text: string): number {
  return text.split(/\n\n/).filter(p => p.trim().length > 0).length
}
