import type { WriteJob } from '../types'

const jobs = new Map<string, WriteJob>()

export const sessionStore = {
  set(sessionId: string, job: WriteJob): void {
    jobs.set(sessionId, job)
  },

  get(sessionId: string): WriteJob | undefined {
    return jobs.get(sessionId)
  },

  delete(sessionId: string): void {
    jobs.delete(sessionId)
  },

  has(sessionId: string): boolean {
    return jobs.has(sessionId)
  },
}
