import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs/promises'
import { createResolver } from '@nuxt/kit'
import { globby } from 'globby'
import { $fetch } from 'ofetch'
import { exec } from 'tinyexec'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ensureLocalModuleStub, extractOgImageUrl, getWranglerTestEnv, isWranglerRuntimeUnsupportedError, readLatestWranglerLog, setupImageSnapshots, SNAPSHOT_STRICT } from '../utils'

const { resolve } = createResolver(import.meta.url)
const fixtureDir = resolve('../fixtures/cloudflare-satori')
const wranglerEnvName = 'cloudflare-satori'

setupImageSnapshots(SNAPSHOT_STRICT)

// Check if satori deps are available
let hasSatoriDeps = false
try {
  await import('satori')
  await import('@resvg/resvg-wasm')
  hasSatoriDeps = true
}
catch {
  hasSatoriDeps = false
}

// Check if wrangler is available
let hasWrangler = false
try {
  await exec('wrangler', ['--version'], {
    nodeOptions: {
      env: getWranglerTestEnv(process.env, wranglerEnvName),
    },
  })
  hasWrangler = true
}
catch {
  hasWrangler = false
}

const canRunTests = hasSatoriDeps && hasWrangler
const isCI = !!process.env.CI
const hasSandboxedRuntime = !!process.env.CODEX_SANDBOX_NETWORK_DISABLED || !!process.env.NUXT_OG_IMAGE_SKIP_EDGE_RUNTIME

let wranglerProcess: ChildProcess | null = null
let serverUrl = ''
let skipWranglerRuntime = false

async function buildFixture() {
  await ensureLocalModuleStub()
  await exec('nuxt', ['build'], {
    nodeOptions: {
      cwd: fixtureDir,
      env: { ...process.env, NUXT_OG_IMAGE_SKIP_ONBOARDING: '1' },
    },
  })
}

async function startWrangler(): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false
    const proc = spawn('wrangler', ['dev', '--port', '8789'], {
      cwd: fixtureDir,
      env: {
        ...getWranglerTestEnv(process.env, wranglerEnvName),
        CI: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    wranglerProcess = proc
    let output = ''
    const finish = (value: string) => {
      if (settled)
        return
      settled = true
      resolve(value)
    }
    const fail = (message: string) => {
      if (settled)
        return
      settled = true
      reject(new Error(`Wrangler failed to start: ${message}`))
    }

    proc.stdout?.on('data', (data) => {
      output += data.toString()
      const match = output.match(/Ready on (http:\/\/\S+)/)
      if (match?.[1])
        finish(match[1])
    })

    proc.stderr?.on('data', (data) => {
      output += data.toString()
    })

    proc.on('error', error => fail(`${output}\n${error.message}`.trim()))
    proc.on('close', async (code) => {
      if (!settled && code)
        fail([output, await readLatestWranglerLog(wranglerEnvName)].filter(Boolean).join('\n'))
    })
    setTimeout(fail, 30000, output)
  })
}

function stopWrangler() {
  if (wranglerProcess) {
    wranglerProcess.kill()
    wranglerProcess = null
  }
}

describe('cloudflare-satori', () => {
  describe.runIf(canRunTests)('prerendered images', () => {
    beforeAll(async () => {
      await buildFixture()
    }, 120000)

    it('generates valid prerendered og images with satori wasm', async () => {
      const imagePath = resolve(fixtureDir, '.output/public/_og')
      const images = await globby('**/*.png', { cwd: imagePath }).then((r: string[]) => r.sort())

      expect(images.length).toBeGreaterThan(0)

      for (const image of images) {
        const imageBuffer = await fs.readFile(resolve(imagePath, image))
        expect(imageBuffer).toMatchImageSnapshot({
          customSnapshotIdentifier: `cloudflare-satori-prerender-${image.replace(/\//g, '-').replace('.png', '')}`,
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

  // Skip wrangler runtime in CI or sandboxed environments where local interfaces are unavailable
  describe.runIf(canRunTests && !isCI && !hasSandboxedRuntime)('wrangler runtime', () => {
    beforeAll(async () => {
      try {
        serverUrl = await startWrangler()
      }
      catch (error) {
        if (isWranglerRuntimeUnsupportedError(error)) {
          skipWranglerRuntime = true
          return
        }
        throw error
      }
    }, 60000)

    afterAll(() => {
      stopWrangler()
    })

    it('serves prerendered og images via wrangler', async () => {
      if (skipWranglerRuntime)
        return

      const html = await $fetch<string>(serverUrl)
      const ogImagePath = extractOgImageUrl(html)
      expect(ogImagePath).toBeTruthy()

      const image = await $fetch(`${serverUrl}${ogImagePath}`, {
        responseType: 'arrayBuffer' as const,
      })

      expect(Buffer.from(image)).toMatchImageSnapshot({
        customSnapshotIdentifier: 'cloudflare-satori-wrangler-runtime',
      })
    }, 30000)

    it('generates og images dynamically at runtime via wrangler', async () => {
      if (skipWranglerRuntime)
        return

      const image = await $fetch(`${serverUrl}/_og/d/image?path=/`, {
        responseType: 'arrayBuffer' as const,
      })

      const buf = Buffer.from(image)
      expect(buf[0]).toBe(0x89)
      expect(buf[1]).toBe(0x50) // P
      expect(buf[2]).toBe(0x4E) // N
      expect(buf[3]).toBe(0x47) // G
      expect(buf.length).toBeGreaterThan(1000)
    }, 30000)
  })

  it.runIf(!canRunTests)('skips tests (missing satori, @resvg/resvg-wasm, or wrangler)', () => {
    expect(true).toBe(true)
  })

  it.runIf(canRunTests && isCI)('skips wrangler runtime in CI (inspector port conflicts)', () => {
    expect(true).toBe(true)
  })
})
