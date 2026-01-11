import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

// Check if takumi WASM is available
let hasTakumiWasm = false
try {
  await import('@takumi-rs/wasm')
  hasTakumiWasm = true
}
catch {
  hasTakumiWasm = false
}

await setup({
  rootDir: resolve('../fixtures/cloudflare-takumi'),
  server: true,
  build: true,
})

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

describe('cloudflare takumi edge runtime', () => {
  it.runIf(hasTakumiWasm)('renders takumi image with wasm bindings', async () => {
    const html = await $fetch('/') as string
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()

    const image: ArrayBuffer = await $fetch(ogImageUrl!, {
      responseType: 'arrayBuffer',
    })
    expect(Buffer.from(image)).toMatchImageSnapshot({
      customSnapshotIdentifier: 'cloudflare-takumi-wasm',
    })
  }, 60000)

  it.runIf(hasTakumiWasm)('uses correct wasm bindings for cloudflare preset', async () => {
    // Verify the og image URL contains takumi renderer info
    const html = await $fetch('/') as string
    const ogImageUrl = extractOgImageUrl(html)
    expect(ogImageUrl).toBeTruthy()
    expect(ogImageUrl).toContain('/_og/')
  })

  it.runIf(!hasTakumiWasm)('skips cloudflare takumi tests when @takumi-rs/wasm not installed', () => {
    expect(true).toBe(true)
  })
})
