import { readFile } from 'node:fs/promises'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

describe('resolved Nuxt fonts in dev', async () => {
  await setup({ rootDir: resolve('../fixtures/font-cache'), dev: true })

  it('serves hook-provided bytes without public font files', async () => {
    const expected = await readFile(resolve('../../src/runtime/public/_og-fonts/inter-400-latin.ttf'))
    const received = await $fetch('/api/font', { responseType: 'arrayBuffer' }) as ArrayBuffer
    expect(Buffer.from(received)).toEqual(expected)
  })

  it('serves the bundled font to DevTools in development', async () => {
    const expected = await readFile(resolve('../../src/runtime/public/_og-fonts/inter-700-latin.ttf'))
    const received = await $fetch('/_og-static-fonts/inter-700-latin.ttf', { responseType: 'arrayBuffer' }) as ArrayBuffer
    expect(Buffer.from(received)).toEqual(expected)
  })

  it('rejects font paths outside the resolved font list', async () => {
    await expect($fetch('/_og-static-fonts/unknown.ttf')).rejects.toMatchObject({ statusCode: 404 })
  })
})
