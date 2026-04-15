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
    const t0 = performance.now()
    return () => {
      const ms = performance.now() - t0
      record(name, ms)
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
