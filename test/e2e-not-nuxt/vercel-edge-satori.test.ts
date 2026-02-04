import * as fs from 'node:fs/promises'
import { createResolver } from '@nuxt/kit'
import { globby } from 'globby'
import { configureToMatchImageSnapshot } from 'jest-image-snapshot'
import { $fetch } from 'ofetch'
import { exec } from 'tinyexec'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)
const fixtureDir = resolve('../fixtures/vercel-edge-satori')

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
  await import('@resvg/resvg-wasm')
  hasSatoriDeps = true
}
catch {
  hasSatoriDeps = false
}

// Check if vercel CLI is available and authenticated
let hasVercel = false
try {
  await exec('vercel', ['whoami'])
  hasVercel = true
}
catch {
  hasVercel = false
}

const canRunTests = hasSatoriDeps && hasVercel
const isCI = !!process.env.CI
// Deploy to a team with Pro plan to avoid 1MB edge function size limit
const vercelScope = process.env.VERCEL_SCOPE || 'my-team-47a10b37'

let deploymentUrl = ''

async function buildFixture() {
  await exec('nuxt', ['build'], {
    nodeOptions: {
      cwd: fixtureDir,
      env: { ...process.env, NUXT_OG_IMAGE_SKIP_ONBOARDING: '1' },
    },
  })
}

async function deployToVercel(): Promise<string> {
  const { stdout } = await exec('vercel', ['deploy', '--prebuilt', '--yes', '--scope', vercelScope], {
    nodeOptions: {
      cwd: fixtureDir,
    },
  })
  // vercel deploy returns the deployment URL as the last line
  const url = stdout.trim().split('\n').pop()!
  return url
}

async function deleteDeployment(url: string) {
  await exec('vercel', ['rm', url, '--yes', '--scope', vercelScope], {
    throwOnError: false,
  })
}

describe('vercel-edge-satori', () => {
  describe.runIf(canRunTests)('prerendered images', () => {
    beforeAll(async () => {
      await buildFixture()
    }, 120000)

    it('generates valid prerendered og images with satori on vercel edge', async () => {
      const imagePath = resolve(fixtureDir, '.vercel/output/static/_og')
      const images = await globby('**/*.png', { cwd: imagePath }).then((r: string[]) => r.sort())

      expect(images.length).toBeGreaterThan(0)

      for (const image of images) {
        const imageBuffer = await fs.readFile(resolve(imagePath, image))
        expect(imageBuffer).toMatchImageSnapshot({
          customSnapshotIdentifier: `vercel-edge-satori-prerender-${image.replace(/\//g, '-').replace('.png', '')}`,
        })
      }
    })

    it('includes og:image meta tag in html', async () => {
      const indexHtml = await fs.readFile(resolve(fixtureDir, '.vercel/output/static/index.html'), 'utf-8')
      const ogImage = /<meta property="og:image" content="([^"]+)"/.exec(indexHtml)
      expect(ogImage?.[1]).toBeTruthy()
      expect(ogImage?.[1]).toContain('/_og/')
    })
  })

  // Deploy to Vercel and test runtime OG image generation on the edge
  describe.runIf(canRunTests && !isCI)('vercel edge runtime', () => {
    beforeAll(async () => {
      const outputExists = await fs.access(resolve(fixtureDir, '.vercel/output/config.json')).then(() => true).catch(() => false)
      if (!outputExists)
        await buildFixture()
      deploymentUrl = await deployToVercel()
    }, 180000)

    afterAll(async () => {
      if (deploymentUrl)
        await deleteDeployment(deploymentUrl)
    })

    it('serves og images dynamically from vercel edge', async () => {
      const html = await $fetch<string>(deploymentUrl)
      const ogImageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
        || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)

      expect(ogImageMatch?.[1]).toBeTruthy()

      // Request the dynamic endpoint (/_og/d/) to force runtime generation
      const ogImageUrl = ogImageMatch![1]!
      const dynamicUrl = ogImageUrl.replace('/_og/s/', '/_og/d/')
      // Rewrite origin to deployment URL (meta tag may contain configured site.url)
      const fetchUrl = new URL(new URL(dynamicUrl.startsWith('http') ? dynamicUrl : `https://example.com${dynamicUrl}`).pathname, deploymentUrl).href

      const image = await $fetch(fetchUrl, {
        responseType: 'arrayBuffer' as const,
      })

      expect(Buffer.from(image)).toMatchImageSnapshot({
        customSnapshotIdentifier: 'vercel-edge-satori-runtime',
      })
    }, 60000)
  })

  it.runIf(!canRunTests)('skips tests (missing satori, @resvg/resvg-wasm, or vercel CLI)', () => {
    expect(true).toBe(true)
  })

  it.runIf(canRunTests && isCI)('skips vercel edge runtime in CI', () => {
    expect(true).toBe(true)
  })
})
