/**
 * Token bucket rate limiter for Google Docs API.
 * Capacity: 250 tokens, refill rate: ~4.16 tokens/second (250/min).
 */
export class RateLimiter {
  private tokens: number
  private readonly capacity: number
  private readonly refillRate: number // tokens per ms
  private lastRefill: number

  constructor(capacity = 250, refillPerMinute = 250) {
    this.capacity = capacity
    this.tokens = capacity
    this.refillRate = refillPerMinute / 60000
    this.lastRefill = Date.now()
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate)
    this.lastRefill = now
  }

  async acquire(): Promise<void> {
    this.refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return
    }
    // Calculate wait time until we have 1 token
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate)
    await sleep(waitMs)
    this.tokens -= 1
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const globalRateLimiter = new RateLimiter(250, 250)
