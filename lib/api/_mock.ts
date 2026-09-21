// Shared helpers for the mock API layer. Delete this file when every resource
// in lib/api/ talks to the real backend.

/** Simulated network latency (300–600ms) so loading states are real. */
export function delay<T>(value: T): Promise<T> {
  const ms = 300 + Math.random() * 300
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      // Dev aid: run `window.__MOCK_FAIL__ = true` in the console to see error states.
      if ((globalThis as { __MOCK_FAIL__?: boolean }).__MOCK_FAIL__) reject(new Error("Couldn't reach the server (simulated failure)."))
      else resolve(value)
    }, ms),
  )
}

/** Deep-ish clone so callers can't mutate the in-memory "database". */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

let counter = 1000
export function newId(prefix: string): string {
  counter += 1
  return `${prefix}_${counter}`
}

export function isoAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

export function isoDate(daysFromToday: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  return d.toISOString().slice(0, 10)
}
