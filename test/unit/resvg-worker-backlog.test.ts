import { describe, expect, it } from 'vitest'

// Regression test for the concurrent-prerender failure: render timers used to
// start at enqueue time while the worker executed jobs serially, so once the
// queued backlog exceeded the budget, a "timeout" fired for a healthy job and
// its handler rejected every other pending render. With an execution-scoped
// timer, a deep backlog must complete even when total queue wait far exceeds
// the per-render budget.
//
// The budget is shrunk via NUXT_OG_IMAGE_WORKER_TIMEOUT so the backlog
// condition is reachable in a unit test; the env var must be set before the
// binding module (which reads it at load time) is imported.

const TIMEOUT_MS = 5000
process.env.NUXT_OG_IMAGE_WORKER_TIMEOUT = String(TIMEOUT_MS)

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

// A render of this canvas takes roughly 300-500ms, so one render sits well
// inside the budget while the batch's total queue wait is several times it.
const BLURRED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><filter id="b"><feGaussianBlur stdDeviation="30"/></filter></defs>
  <rect width="1200" height="630" fill="#0b1021"/>
  <circle cx="400" cy="300" r="220" fill="#38bdf8" filter="url(#b)"/>
  <circle cx="800" cy="330" r="220" fill="#f472b6" filter="url(#b)"/>
</svg>`

describe('resvg worker backlog', () => {
  it('drains a backlog whose total queue wait exceeds the render budget', async () => {
    const { default: ResvgBinding } = await import('../../src/runtime/server/og-image/bindings/resvg/node-dev')
    const { Resvg } = ResvgBinding

    const started = Date.now()
    const results = await Promise.all(
      Array.from({ length: 30 }, () => (new Resvg(BLURRED_SVG) as any).render().asPng()),
    )
    const elapsed = Date.now() - started

    // The backlog must genuinely outlast the budget, otherwise this test
    // proves nothing — bump the batch size if a machine gets this fast.
    expect(elapsed).toBeGreaterThan(TIMEOUT_MS)

    expect(results).toHaveLength(30)
    for (const png of results)
      expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true)
  }, 60_000)
})
