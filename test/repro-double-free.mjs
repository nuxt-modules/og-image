/**
 * Reproduces "double free or corruption (fasttop)" crash in @takumi-rs/core.
 *
 * The native Renderer is not safe for concurrent loadFont + render calls on
 * the same instance. This simulates what happens when a Nuxt server handles
 * multiple OG image requests concurrently — each request loads fonts and
 * renders on the shared Renderer instance.
 *
 * Usage: node test/repro-double-free.mjs
 */
import { readFileSync } from 'node:fs'
import { Renderer } from '@takumi-rs/core'

const CONCURRENCY = 50
const ROUNDS = 20

const fontPath = 'test/fixtures/app-dir/.output/public/_og-static-fonts/inter-400-latin.ttf'
const fontData = new Uint8Array(readFileSync(fontPath))

const nodes = {
  type: 'container',
  tw: 'flex w-full h-full bg-slate-900 items-center justify-center',
  children: [
    { type: 'text', text: 'Hello World', tw: 'text-white text-5xl' },
    {
      type: 'container',
      tw: 'flex flex-col gap-2 p-4',
      children: Array.from({ length: 10 }, (_, i) => ({
        type: 'text',
        text: `Item ${i} — ${'x'.repeat(50)}`,
        tw: 'text-gray-300 text-lg',
      })),
    },
  ],
}
const opts = { width: 1200, height: 630, format: 'png' }

// Simulate concurrent requests: each "request" creates/reuses a renderer,
// loads a font subset, and renders — exactly like the Nuxt server does.
const renderer = new Renderer()

async function simulateRequest(id) {
  // Each request loads a "new" font subset (unique name) then renders
  await renderer.loadFont({
    name: `inter-subset-${id}`,
    data: fontData,
    weight: 400,
    style: 'normal',
  })
  return renderer.render(nodes, opts)
}

async function run() {
  for (let round = 1; round <= ROUNDS; round++) {
    // eslint-disable-next-line no-console
    console.log(`Round ${round}/${ROUNDS}: ${CONCURRENCY} concurrent loadFont+render...`)
    await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) =>
      simulateRequest(round * CONCURRENCY + i)))
  }
  // eslint-disable-next-line no-console
  console.log(`Completed ${ROUNDS * CONCURRENCY} renders without crash.`)
}

run()
