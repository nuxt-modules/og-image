import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs/promises'
import { join } from 'node:path'
import { createResolver } from '@nuxt/kit'
import { execa } from 'execa'
import { globby } from 'globby'
import { configureToMatchImageSnapshot } from 'jest-image-snapshot'
import { $fetch } from 'ofetch'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)
const fixtureDir = resolve('../fixtures/cloudflare-takumi')

const toMatchImageSnapshot = configureToMatchImageSnapshot({
  customDiffConfig: {
    threshold: 0.1,
  },
  failureThresholdType: 'percent',
  failureThreshold: 0.1,
})
expect.extend({ toMatchImageSnapshot })

// Check if takumi WASM is available (direct pkg import — bundlers entry needs a bundler)
let hasTakumiWasm = false
const wasmPkgDir = resolve('../../node_modules/@takumi-rs/wasm/pkg')
try {
  await fs.access(join(wasmPkgDir, 'takumi_wasm_bg.wasm'))
  hasTakumiWasm = true
}
catch {
  hasTakumiWasm = false
}

// Check if wrangler is available
let hasWrangler = false
try {
  await execa('wrangler', ['--version'])
  hasWrangler = true
}
catch {
  hasWrangler = false
}

const canRunTests = hasTakumiWasm && hasWrangler
const isCI = !!process.env.CI

let wranglerProcess: ChildProcess | null = null
let serverUrl = ''

async function buildFixture() {
  await execa('nuxt', ['build'], {
    cwd: fixtureDir,
    env: { ...process.env, NUXT_OG_IMAGE_SKIP_ONBOARDING: '1' },
  })
}

async function startWrangler(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('wrangler', ['dev', '--port', '8788'], {
      cwd: fixtureDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    wranglerProcess = proc
    let output = ''

    proc.stdout?.on('data', (data) => {
      output += data.toString()
      const match = output.match(/Ready on (http:\/\/\S+)/)
      if (match?.[1]) {
        resolve(match[1])
      }
    })

    proc.stderr?.on('data', (data) => {
      output += data.toString()
    })

    proc.on('error', reject)
    setTimeout(() => reject(new Error(`Wrangler failed to start: ${output}`)), 30000)
  })
}

function stopWrangler() {
  if (wranglerProcess) {
    wranglerProcess.kill()
    wranglerProcess = null
  }
}

describe('cloudflare-takumi', () => {
  // Build fixture once for all test groups that need build output
  beforeAll(async () => {
    if (hasTakumiWasm)
      await buildFixture()
  }, 120000)

  describe.runIf(canRunTests)('prerendered images', () => {
    it('generates valid prerendered og images with takumi wasm', async () => {
      const imagePath = resolve(fixtureDir, '.output/public/_og')
      const images = await globby('**/*.png', { cwd: imagePath }).then((r: string[]) => r.sort())

      expect(images.length).toBeGreaterThan(0)

      for (const image of images) {
        const imageBuffer = await fs.readFile(resolve(imagePath, image))
        expect(imageBuffer).toMatchImageSnapshot({
          customSnapshotIdentifier: `cloudflare-takumi-prerender-${image.replace(/\//g, '-').replace('.png', '')}`,
        })
      }
    })

    it('includes og:image meta tag in html', async () => {
      const indexHtml = await fs.readFile(resolve(fixtureDir, '.output/public/index.html'), 'utf-8')
      const ogImage = /<meta property="og:image" content="([^"]+)"/.exec(indexHtml)
      expect(ogImage?.[1]).toBeTruthy()
      expect(ogImage?.[1]).toContain('/_og/')
    })
  })

  // Skip wrangler runtime in CI - inspector port 9229 conflicts with other processes
  describe.runIf(canRunTests && !isCI)('wrangler runtime', () => {
    beforeAll(async () => {
      serverUrl = await startWrangler()
    }, 60000)

    afterAll(() => {
      stopWrangler()
    })

    it('serves og images dynamically via wrangler', async () => {
      const html = await $fetch<string>(serverUrl)
      const ogImageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
        || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)

      expect(ogImageMatch?.[1]).toBeTruthy()

      const ogImagePath = new URL(ogImageMatch![1]!).pathname
      const image = await $fetch(`${serverUrl}${ogImagePath}`, {
        responseType: 'arrayBuffer' as const,
      })

      expect(Buffer.from(image)).toMatchImageSnapshot({
        customSnapshotIdentifier: 'cloudflare-takumi-wrangler-runtime',
      })
    }, 30000)
  })

  // Tests the font subset glyph fallback fix: Google Fonts serves variable fonts as
  // multiple WOFF2 subsets (one per unicode-range). When all subsets are loaded with
  // the same font name, the renderer only uses the first match and won't fall through
  // to other subsets for missing glyphs, producing NO GLYPH boxes. Loading each subset
  // with a unique name and using a comma-separated fontFamily enables proper fallback.
  describe.runIf(hasTakumiWasm)('font subset glyph fallback', () => {
    let Renderer: any
    let fontSubsets: Uint8Array[]

    beforeAll(async () => {
      const wasmBytes = await fs.readFile(join(wasmPkgDir, 'takumi_wasm_bg.wasm'))
      const wasmJs = await import(join(wasmPkgDir, 'takumi_wasm.js'))
      await wasmJs.default({ module_or_path: await WebAssembly.compile(wasmBytes) })
      Renderer = wasmJs.Renderer

      const fontsDir = resolve(fixtureDir, '.output/public/_fonts')
      const woff2Files = await globby('*.woff2', { cwd: fontsDir })
      fontSubsets = await Promise.all(
        woff2Files.map(async f => new Uint8Array(await fs.readFile(join(fontsDir, f)))),
      )
    })

    function makeNodes(fontFamily: string) {
      return {
        type: 'container',
        style: { display: 'flex', width: '400px', height: '80px', backgroundColor: '#333', color: 'white', alignItems: 'center', justifyContent: 'center', fontFamily },
        children: [{ type: 'text', text: 'Hello', style: { fontSize: '48px' } }],
      }
    }

    function findWorkingSubset(): Uint8Array | undefined {
      for (const data of fontSubsets) {
        try {
          const r = new Renderer()
          r.loadFont({ name: 'Probe', data, weight: 400, style: 'normal' })
          const res = r.render(makeNodes('Probe'), { width: 400, height: 80, format: 'png' })
          if (res.length < 2800)
            return data
        }
        catch {}
      }
    }

    it('shows NO GLYPH when all subsets share the same name', async () => {
      expect(fontSubsets.length).toBeGreaterThan(0)

      const renderer = new Renderer()
      for (const data of fontSubsets) {
        try {
          renderer.loadFont({ name: 'Inter', data, weight: 400, style: 'normal' })
        }
        catch {}
      }

      const bad = renderer.render(makeNodes('Inter'), { width: 400, height: 80, format: 'png' })

      const workingSubset = findWorkingSubset()
      expect(workingSubset).toBeTruthy()

      const solo = new Renderer()
      solo.loadFont({ name: 'Inter', data: workingSubset!, weight: 400, style: 'normal' })
      const good = solo.render(makeNodes('Inter'), { width: 400, height: 80, format: 'png' })

      // The all-same-name render should differ from the working render (it has NO GLYPH)
      expect(Buffer.from(bad).equals(Buffer.from(good))).toBe(false)
    })

    it('renders text when each subset has a unique name with comma-separated fontFamily', async () => {
      expect(fontSubsets.length).toBeGreaterThan(0)

      const renderer = new Renderer()
      const names: string[] = []
      for (let i = 0; i < fontSubsets.length; i++) {
        const name = `Inter__${i}`
        try {
          renderer.loadFont({ name, data: fontSubsets[i], weight: 400, style: 'normal' })
          names.push(name)
        }
        catch {}
      }

      const result = renderer.render(
        makeNodes(names.join(', ')),
        { width: 400, height: 80, format: 'png' },
      )

      // With unique names the renderer falls through subsets until it finds the glyph.
      // NO GLYPH boxes for 5 chars ("Hello") produce a larger PNG than actual text.
      // Working renders are consistently under 2800 bytes for this simple test.
      expect(result.length).toBeLessThan(2800)
      expect(Buffer.from(result)).toMatchImageSnapshot({
        customSnapshotIdentifier: 'cloudflare-takumi-font-subset-fallback',
      })
    })
  })

  it.runIf(!canRunTests)('skips tests (missing @takumi-rs/wasm or wrangler)', () => {
    expect(true).toBe(true)
  })

  it.runIf(canRunTests && isCI)('skips wrangler runtime in CI (inspector port conflicts)', () => {
    expect(true).toBe(true)
  })
})
