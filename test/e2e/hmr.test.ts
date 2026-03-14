import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createResolver } from '@nuxt/kit'
import { setup } from '@nuxt/test-utils/e2e'
import { afterAll, describe, expect, it } from 'vitest'
import { fetchOgHtml, waitFor } from '../utils'

const { resolve } = createResolver(import.meta.url)

const fixtureRoot = resolve('../fixtures/basic')
const ogComponentsDir = join(fixtureRoot, 'components/OgImage')
const pagesDir = join(fixtureRoot, 'pages')

// Track files created during test for cleanup
const createdFiles: string[] = []

describe.skipIf(!import.meta.env?.TEST_DEV)('hmr', async () => {
  await setup({
    rootDir: fixtureRoot,
    dev: true,
  })

  afterAll(() => {
    for (const file of createdFiles) {
      if (existsSync(file))
        unlinkSync(file)
    }
  })

  it('initial render works in dev mode', async () => {
    const preview = await fetchOgHtml('/satori')
    expect(preview).toBeTruthy()
    expect(preview).toContain('Hello World')
  }, 60000)

  it('component content change is reflected via HMR', async () => {
    // Create a new OG component + page
    const componentPath = join(ogComponentsDir, 'HmrTest.satori.vue')
    writeFileSync(componentPath, `<script setup lang="ts">
withDefaults(defineProps<{ title?: string }>(), { title: 'Default' })
</script>
<template>
  <div :style="{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#fff', padding: '60px' }">
    <h1 :style="{ fontSize: '72px' }">{{ title }}</h1>
    <p>HMR Version 1</p>
  </div>
</template>
`, 'utf-8')
    createdFiles.push(componentPath)

    const pagePath = join(pagesDir, 'hmr-test.vue')
    writeFileSync(pagePath, `<script lang="ts" setup>
defineOgImage('HmrTest', { title: 'HMR Title' })
</script>
<template>
  <div><h1>HMR Test</h1></div>
</template>
`, 'utf-8')
    createdFiles.push(pagePath)

    // Wait for the new component to be available
    await waitFor(async () => {
      const preview = await fetchOgHtml('/hmr-test')
      return !!preview?.includes('HMR Version 1')
    }, { timeout: 20000 })

    // Modify the component content
    const modified = readFileSync(componentPath, 'utf-8').replace('HMR Version 1', 'HMR Version 2')
    writeFileSync(componentPath, modified, 'utf-8')

    // Wait for the change to be reflected
    await waitFor(async () => {
      const preview = await fetchOgHtml('/hmr-test')
      return !!preview?.includes('HMR Version 2')
    }, { timeout: 15000 })

    const preview = await fetchOgHtml('/hmr-test')
    expect(preview).toContain('HMR Version 2')
    expect(preview).not.toContain('HMR Version 1')
  }, 45000)

  it('new OG component + page is discoverable via HMR', async () => {
    const componentPath = join(ogComponentsDir, 'HmrNew.satori.vue')
    writeFileSync(componentPath, `<script setup lang="ts">
withDefaults(defineProps<{ title?: string }>(), { title: 'New Component' })
</script>
<template>
  <div :style="{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#00dc82', padding: '60px' }">
    <h1 :style="{ fontSize: '72px', color: '#fff' }">{{ title }}</h1>
    <p :style="{ color: '#fff' }">Dynamically Added</p>
  </div>
</template>
`, 'utf-8')
    createdFiles.push(componentPath)

    const pagePath = join(pagesDir, 'hmr-new.vue')
    writeFileSync(pagePath, `<script lang="ts" setup>
defineOgImage('HmrNew', { title: 'Fresh Component' })
</script>
<template>
  <div><h1>New Page</h1></div>
</template>
`, 'utf-8')
    createdFiles.push(pagePath)

    // Wait for discovery
    await waitFor(async () => {
      const preview = await fetchOgHtml('/hmr-new')
      return !!preview?.includes('Dynamically Added')
    }, { timeout: 20000 })

    const preview = await fetchOgHtml('/hmr-new')
    expect(preview).toContain('Fresh Component')
    expect(preview).toContain('Dynamically Added')
  }, 30000)
})
