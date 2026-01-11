import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { createResolver } from '@nuxt/kit'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { $fetch as _$fetch } from 'ofetch'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)
const fixtureDir = resolve('../fixtures/cloudflare-takumi')

// Check if takumi WASM is available
let hasTakumiWasm = false
try {
  await import('@takumi-rs/wasm')
  hasTakumiWasm = true
}
catch {
  hasTakumiWasm = false
}

// Check if wrangler is available
let hasWrangler = false
try {
  const { execSync } = await import('node:child_process')
  execSync('npx wrangler --version', { stdio: 'ignore' })
  hasWrangler = true
}
catch {
  hasWrangler = false
}

const canRunTests = hasTakumiWasm && hasWrangler

let wranglerProcess: ChildProcess | null = null
let serverUrl = ''

async function buildFixture() {
  const { execSync } = await import('node:child_process')
  execSync('npx nuxi build', {
    cwd: fixtureDir,
    stdio: 'inherit',
    env: { ...process.env, NUXT_OG_IMAGE_SKIP_ONBOARDING: '1' },
  })
}

async function startWrangler(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['wrangler', 'dev', '--port', '8787'], {
      cwd: fixtureDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    wranglerProcess = proc
    let output = ''

    proc.stdout?.on('data', (data) => {
      output += data.toString()
      // Look for the ready message
      const match = output.match(/Ready on (http:\/\/[^\s]+)/)
      if (match) {
        resolve(match[1])
      }
    })

    proc.stderr?.on('data', (data) => {
      output += data.toString()
    })

    proc.on('error', reject)

    // Timeout after 30s
    setTimeout(() => reject(new Error(`Wrangler failed to start: ${output}`)), 30000)
  })
}

function stopWrangler() {
  if (wranglerProcess) {
    wranglerProcess.kill()
    wranglerProcess = null
  }
}

expect.extend({ toMatchImageSnapshot })

function extractOgImageUrl(html: string): string | null {
  const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
  if (!match?.[1])
    return null
  try {
    const url = new URL(match[1])
    return url.pathname
  }
  catch {
    return match[1]
  }
}

describe('cloudflare takumi workers runtime', () => {
  beforeAll(async () => {
    if (!canRunTests)
      return

    await buildFixture()
    serverUrl = await startWrangler()
  }, 120000)

  afterAll(() => {
    stopWrangler()
  })

  it.runIf(canRunTests)('renders takumi image with wasm bindings on cloudflare workers', async () => {
    const html = await _$fetch<string>(serverUrl)
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    const image = await _$fetch<ArrayBuffer>(`${serverUrl}${ogImageUrl}`, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(image)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'cloudflare-takumi-wasm',
    })
  }, 60000)

  it.runIf(canRunTests)('uses correct wasm bindings for cloudflare preset', async () => {
    const html = await _$fetch<string>(serverUrl)
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()
    expect(ogImageUrl).toContain('/_og/')
  })

  it.runIf(!canRunTests)('skips cloudflare takumi tests (missing @takumi-rs/wasm or wrangler)', () => {
    expect(true).toBe(true)
  })
})
