import { readFile } from 'node:fs/promises'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

describe('cached Nuxt fonts in dev', async () => {
  await setup({ rootDir: resolve('../fixtures/font-cache'), dev: true })

  it('serves cached bytes without a CDN mapping', async () => {
    const expected = await readFile(resolve('../../src/runtime/public/_og-fonts/inter-400-latin.ttf'))
    const received = await $fetch('/api/font', { responseType: 'arrayBuffer' }) as ArrayBuffer
    expect(Buffer.from(received)).toEqual(expected)
  })
})
