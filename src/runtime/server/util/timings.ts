export interface TimingEntry {
  name: string
  dur: number
  count?: number
}

export interface Timings {
  start: (name: string) => () => number
  record: (name: string, ms: number) => void
  measure: <T>(name: string, fn: () => Promise<T> | T) => Promise<T>
  entries: () => TimingEntry[]
  header: () => string
}

const RE_TOKEN = /[^\w-]/g

function sanitizeName(name: string): string {
  return name.replace(RE_TOKEN, '_')
}

export function createTimings(): Timings {
  const totals = new Map<string, { dur: number, count: number }>()
  // Per-name interval tracking so overlapping parallel spans (e.g. image-fetch
  // inside Promise.all) report wall time, not summed CPU-across-parallel.
  interface SpanState { open: number, windowStart: number, wall: number }
  const spans = new Map<string, SpanState>()

  const record = (name: string, ms: number) => {
    const key = sanitizeName(name)
    const existing = totals.get(key)
    if (existing) {
      existing.dur += ms
      existing.count += 1
    }
    else {
      totals.set(key, { dur: ms, count: 1 })
    }
  }

  const start = (name: string) => {
    const key = sanitizeName(name)
    const t0 = performance.now()
    const span = spans.get(key) ?? { open: 0, windowStart: 0, wall: 0 }
    if (span.open === 0)
      span.windowStart = t0
    span.open += 1
    spans.set(key, span)
    let ended = false
    return () => {
      if (ended)
        return 0
      ended = true
      const t1 = performance.now()
      const ms = t1 - t0
      span.open -= 1
      if (span.open === 0) {
        span.wall += t1 - span.windowStart
        const existing = totals.get(key)
        if (existing) {
          // Replace summed dur with accumulated wall time; keep count as span-count.
          existing.dur = span.wall
          existing.count += 1
        }
        else {
          totals.set(key, { dur: span.wall, count: 1 })
        }
      }
      else {
        // Still overlapping spans open; bump count only.
        const existing = totals.get(key)
        if (existing)
          existing.count += 1
        else
          totals.set(key, { dur: 0, count: 1 })
      }
      return ms
    }
  }

  const measure = async <T>(name: string, fn: () => Promise<T> | T): Promise<T> => {
    const end = start(name)
    try {
      return await fn()
    }
    finally {
      end()
    }
  }

  const entries = (): TimingEntry[] =>
    Array.from(totals.entries()).map(([name, v]) => ({
      name,
      dur: Math.round(v.dur * 1000) / 1000,
      count: v.count > 1 ? v.count : undefined,
    }))

  const header = () =>
    entries()
      .map(({ name, dur, count }) => {
        const desc = count ? `;desc="n=${count}"` : ''
        return `${name}${desc};dur=${dur}`
      })
      .join(', ')

  return { start, record, measure, entries, header }
}

export const TIMING_CTX_KEY = '_ogImageTimings'

export function getTimingsFromEvent(e: { context: Record<string, any> }): Timings | undefined {
  return e.context[TIMING_CTX_KEY]
}
