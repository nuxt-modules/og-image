import { readFile } from 'node:fs/promises'
import { createResolver } from '@nuxt/kit'
import { setup, useTestContext } from '@nuxt/test-utils/e2e'
import { globby } from 'globby'
import { describe, expect, it } from 'vitest'
import { fetchOgImages, setupImageSnapshots, SNAPSHOT_DEFAULT } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
})

setupImageSnapshots(SNAPSHOT_DEFAULT)

describe('build', () => {
  it('static images', async () => {
    const images = await fetchOgImages(
      '/satori/custom-font',
      '/satori/image',
      '/satori',
    )
    expect(images.get('/satori/custom-font')).toMatchImageSnapshot()
    expect(images.get('/satori/image')).toMatchImageSnapshot()
    expect(images.get('/satori')).toMatchImageSnapshot()
  }, 60000)

  it('dynamic images', async () => {
    const images = await fetchOgImages(
      '/satori/route-rules/inline',
      '/satori/route-rules/config',
      '/satori/route-rules',
    )
    expect(images.get('/satori/route-rules/inline')).toMatchImageSnapshot()
    expect(images.get('/satori/route-rules/config')).toMatchImageSnapshot()
    expect(images.get('/satori/route-rules')).toMatchImageSnapshot()
  })

  it('does not bundle build machine paths', async () => {
    const outputDir = useTestContext().nuxt!.options.nitro.output!.dir!
    const files = await globby('**/*.{mjs,js,json,html}', { cwd: outputDir, absolute: true })
    const repoRoot = resolve('../..')
    const filesWithPaths: string[] = []
    for (const file of files) {
      // `@vitejs/plugin-vue` adds `__file` outside production builds.
      const contents = (await readFile(file, 'utf8')).replace(/["`]__file["`],\s*["`][^"`]*["`]/g, '')
      if (contents.includes(repoRoot))
        filesWithPaths.push(file.slice(outputDir.length))
    }
    expect(filesWithPaths).toEqual([])
  })
})
