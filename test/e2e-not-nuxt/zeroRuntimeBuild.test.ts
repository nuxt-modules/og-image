import { spawn } from 'node:child_process'
import fs, { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { createResolver } from '@nuxt/kit'
import { globby } from 'globby'
import { exec } from 'tinyexec'
import { afterEach, describe, expect, it } from 'vitest'
import { ensureLocalModuleStub, setupImageSnapshots, SNAPSHOT_STRICT, waitFor } from '../utils'

const { resolve } = createResolver(import.meta.url)

setupImageSnapshots(SNAPSHOT_STRICT)

const fixtureDir = resolve('../fixtures/zero-runtime')
const nuxtConfigPath = resolve(fixtureDir, 'nuxt.config.ts')

async function getFreePort(): Promise<number> {
  return new Promise((done, fail) => {
    const server = createServer()
    server.once('error', fail)
    server.listen(0, () => {
      const address = server.address()
      server.close(() => done(typeof address === 'object' && address ? address.port : 0))
    })
  })
}

async function fetchFromBuiltServer(path: string): Promise<Response> {
  const port = await getFreePort()
  const proc = spawn(process.execPath, [resolve(fixtureDir, '.output/server/index.mjs')], {
    env: { ...process.env, PORT: String(port), NITRO_PORT: String(port) },
    stdio: 'ignore',
  })
  try {
    let response: Response | undefined
    await waitFor(async () => {
      response = await fetch(`http://localhost:${port}${path}`).catch(() => {
        // Connection failures are expected while the server starts.
        return undefined
      })
      return response !== undefined
    })
    // Read the body before stopping the server.
    const body = await response!.arrayBuffer()
    return new Response(body, { status: response!.status, headers: response!.headers })
  }
  finally {
    proc.kill()
  }
}

describe('zeroRuntime', () => {
  let originalConfig: string | null = null

  afterEach(async () => {
    if (originalConfig) {
      await writeFile(nuxtConfigPath, originalConfig)
      originalConfig = null
    }
  })

  it('basic', async () => {
    await ensureLocalModuleStub()
    await exec('nuxt', ['cleanup'], { nodeOptions: { cwd: fixtureDir } })
    await exec('nuxt', ['build'], { nodeOptions: { cwd: fixtureDir } })
    const serverOutputPath = resolve('../fixtures/zero-runtime/.output/server')
    const { stdout } = await exec('du', ['-sh', serverOutputPath])
    // eslint-disable-next-line style/no-tabs
    console.log(`Size: ${stdout.split('	')[0]}`)
    const imagePath = resolve('../fixtures/zero-runtime/.output/public/_og')
    const images = await globby('**/*.png', { cwd: imagePath }).then((r: string[]) => r.sort())
    expect(images.length).toBeGreaterThan(0)
    // skip pixel-level snapshot comparison — font rendering differs across CI environments
    if (!process.env.CI) {
      for (const image of images) {
        const imageBuffer = await fs.readFile(resolve(imagePath, image))
        expect(imageBuffer).toMatchImageSnapshot({
          customSnapshotIdentifier: image.replace(/[/\\]/g, '-').replace('.png', ''),
          customDiffConfig: {
            threshold: 0.1,
          },
          failureThresholdType: 'percent',
          failureThreshold: 0.1,
        })
      }
    }
    const indexHtml = await readFile(resolve('../fixtures/zero-runtime/.output/public/index.html'), {
      encoding: 'utf-8',
    })
    const ogImage = /<meta property="og:image" content="(.+?)">/.exec(indexHtml)
    expect(ogImage?.[1]).toMatchInlineSnapshot(`"https://nuxtseo.com/_og/s/o_2f5504472ab46099.png"`)

    // A page that is not prerendered has no /_og/d/ handler to point at, so it gets no og:image.
    const runtimeHtml = await fetchFromBuiltServer('/runtime').then(r => r.text())
    expect(runtimeHtml).toContain('Runtime')
    expect(runtimeHtml).not.toContain('og:image')

    const prerenderedImage = await fetchFromBuiltServer(new URL(ogImage![1]!).pathname)
    expect(prerenderedImage.status).toBe(200)
    expect(prerenderedImage.headers.get('content-type')).toContain('image/png')

    for (const path of ['/_og/d/missing.png', '/_og/s/missing.png']) {
      const missingImage = await fetchFromBuiltServer(path)
      expect(missingImage.status).toBe(404)
    }
  }, 120000)

  it('local fonts in config', async () => {
    await ensureLocalModuleStub()
    originalConfig = await readFile(nuxtConfigPath, 'utf-8')

    const modifiedConfig = originalConfig.replace(
      'ogImage: {\n    zeroRuntime: true,\n    sharpOptions: true,\n  },',
      `ogImage: {
    zeroRuntime: true,
    sharpOptions: true,
    fonts: [
      {
        name: 'OPTIEinstein',
        weight: 800,
        path: '/OPTIEinstein-Black.otf',
      },
    ],
  },`,
    )
    await writeFile(nuxtConfigPath, modifiedConfig)

    await exec('nuxt', ['cleanup'], { nodeOptions: { cwd: fixtureDir } })
    await exec('nuxt', ['build'], { nodeOptions: { cwd: fixtureDir } })

    const imagePath = resolve(fixtureDir, '.output/public/_og')
    const images = await globby('**/*.png', { cwd: imagePath })
    expect(images.length).toBeGreaterThan(0)

    const serverChunks = await globby('**/*.mjs', { cwd: resolve(fixtureDir, '.output/server/chunks') })
    const fontChunk = serverChunks.find(c => c.includes('OPTIEinstein'))
    expect(fontChunk).toBeUndefined()
  }, 120000)
})
