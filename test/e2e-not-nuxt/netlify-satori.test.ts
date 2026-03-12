import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs/promises'
import { createResolver } from '@nuxt/kit'
import { globby } from 'globby'
import { configureToMatchImageSnapshot } from 'jest-image-snapshot'
import { $fetch } from 'ofetch'
import { exec } from 'tinyexec'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)
const fixtureDir = resolve('../fixtures/netlify-satori')

const toMatchImageSnapshot = configureToMatchImageSnapshot({
  customDiffConfig: {
    threshold: 0.1,
  },
  failureThresholdType: 'percent',
  failureThreshold: 0.1,
})
expect.extend({ toMatchImageSnapshot })

// Check if satori deps are available
let hasSatoriDeps = false
try {
  await import('satori')
  await import('@napi-rs/image')
  hasSatoriDeps = true
}
catch {
  hasSatoriDeps = false
}

// Check if netlify CLI is available
let hasNetlifyCli = false
try {
  await exec('netlify', ['--version'])
  hasNetlifyCli = true
}
catch {
  hasNetlifyCli = false
}

const canRunTests = hasSatoriDeps
const canRunRuntime = canRunTests && hasNetlifyCli
const isCI = !!process.env.CI

let netlifyProcess: ChildProcess | null = null
let serverUrl = ''

async function buildFixture() {
  await exec('nuxt', ['build'], {
    nodeOptions: {
      cwd: fixtureDir,
      env: { ...process.env, NUXT_OG_IMAGE_SKIP_ONBOARDING: '1' },
    },
  })
}

const netlifyPort = 18790 + Math.floor(Math.random() * 100)

async function startNetlifyDev(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('netlify', ['dev', '--port', String(netlifyPort), '--offline', '--dir', 'dist', '--functions', '.netlify/functions-internal'], {
      cwd: fixtureDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    netlifyProcess = proc
    let output = ''

    proc.stdout?.on('data', (data) => {
      output += data.toString()
      const match = output.match(/Local dev server ready: (http:\/\/\S+)/)
      if (match?.[1]) {
        resolve(match[1])
      }
    })

    proc.stderr?.on('data', (data) => {
      output += data.toString()
      // Netlify CLI may also log the ready URL to stderr
      const match = output.match(/Local dev server ready: (http:\/\/\S+)/)
      if (match?.[1]) {
        resolve(match[1])
      }
    })

    proc.on('error', reject)
    setTimeout(() => reject(new Error(`Netlify dev failed to start: ${output}`)), 30000)
  })
}

function stopNetlifyDev() {
  if (netlifyProcess) {
    netlifyProcess.kill()
    netlifyProcess = null
  }
}

describe('netlify-satori', () => {
  describe.runIf(canRunTests)('prerendered images with local fonts', () => {
    beforeAll(async () => {
      await buildFixture()
    }, 120000)

    it('generates valid prerendered og images', async () => {
      const imagePath = resolve(fixtureDir, 'dist/_og')
      const images = await globby('**/*.png', { cwd: imagePath }).then((r: string[]) => r.sort())

      expect(images.length).toBeGreaterThan(0)

      for (const image of images) {
        const imageBuffer = await fs.readFile(resolve(imagePath, image))
        expect(imageBuffer).toMatchImageSnapshot({
          customSnapshotIdentifier: `netlify-satori-prerender-${image.replace(/\//g, '-').replace('.png', '')}`,
        })
      }
    })

    it('includes og:image meta tag in html', async () => {
      const indexHtml = await fs.readFile(resolve(fixtureDir, 'dist/index.html'), 'utf-8')
      const ogImage = /<meta property="og:image" content="([^"]+)"/.exec(indexHtml)
      expect(ogImage?.[1]).toBeTruthy()
      expect(ogImage?.[1]).toContain('/_og/')
    })

    it('server bundle uses node binding for runtime font resolution', async () => {
      const serverDir = resolve(fixtureDir, '.netlify/functions-internal/server')
      const chunks = await globby('**/*.mjs', { cwd: serverDir })
      let foundNodeBinding = false
      for (const chunk of chunks) {
        const content = await fs.readFile(resolve(serverDir, chunk), 'utf-8')
        if (content.includes('getNitroOrigin') && content.includes('Failed to resolve font')) {
          foundNodeBinding = true
          break
        }
      }
      expect(foundNodeBinding).toBe(true)
    })

    it('local font files are included in output', async () => {
      const regular = await fs.stat(resolve(fixtureDir, 'dist/fonts/LocalSans-Regular.ttf')).catch(() => null)
      const bold = await fs.stat(resolve(fixtureDir, 'dist/fonts/LocalSans-Bold.ttf')).catch(() => null)
      expect(regular?.size).toBeGreaterThan(1000)
      expect(bold?.size).toBeGreaterThan(1000)
    })
  })

  // Runtime test: start netlify dev and fetch a dynamic OG image
  describe.runIf(canRunRuntime && !isCI)('netlify dev runtime', () => {
    beforeAll(async () => {
      // Build if not already built
      const outputExists = await fs.access(resolve(fixtureDir, 'dist/index.html')).then(() => true).catch(() => false)
      if (!outputExists)
        await buildFixture()
      serverUrl = await startNetlifyDev()
    }, 60000)

    afterAll(() => {
      stopNetlifyDev()
    })

    it('serves og images dynamically with local fonts via netlify dev', async () => {
      const html = await $fetch<string>(serverUrl)
      const ogImageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
        || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)

      expect(ogImageMatch?.[1]).toBeTruthy()

      // Request the dynamic endpoint (/_og/d/) to force runtime generation
      const ogImageUrl = ogImageMatch![1]!
      const dynamicUrl = ogImageUrl.replace('/_og/s/', '/_og/d/')
      const fetchUrl = new URL(new URL(dynamicUrl.startsWith('http') ? dynamicUrl : `https://example.com${dynamicUrl}`).pathname, serverUrl).href

      const image = await $fetch(fetchUrl, {
        responseType: 'arrayBuffer' as const,
      })

      expect(Buffer.from(image)).toMatchImageSnapshot({
        customSnapshotIdentifier: 'netlify-satori-runtime-local-fonts',
      })
    }, 30000)
  })

  it.runIf(!canRunTests)('skips tests (missing satori or @napi-rs/image)', () => {
    expect(true).toBe(true)
  })

  it.runIf(canRunTests && !canRunRuntime)('skips netlify runtime tests (missing netlify CLI)', () => {
    expect(true).toBe(true)
  })

  it.runIf(canRunRuntime && isCI)('skips netlify dev runtime in CI', () => {
    expect(true).toBe(true)
  })
})
