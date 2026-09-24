import { readFile } from 'node:fs/promises'
import { createResolver } from '@nuxt/kit'
import sharp from 'sharp'
import { exec } from 'tinyexec'
import { describe, expect, it } from 'vitest'
import { ensureLocalModuleStub } from '../utils'

const { resolve } = createResolver(import.meta.url)

const fixtureDir = resolve('../fixtures/browser-prerender')

describe('browser prerender', () => {
  it.runIf(process.env.HAS_CHROME)('reports missing screenshot opt-in during nuxt build', async () => {
    await ensureLocalModuleStub()
    await exec('nuxt', ['cleanup'], { nodeOptions: { cwd: fixtureDir } })
    const build = await exec('nuxt', ['build'], {
      nodeOptions: { cwd: fixtureDir, env: { ...process.env, TEST_BROWSER_OPT_IN: 'false' } },
    })
    expect(build.exitCode).not.toBe(0)
    expect(`${build.stdout}\n${build.stderr}`).toContain('Set ogImage.browser to true')
  }, 180000)

  it.runIf(process.env.HAS_CHROME)('renders a page screenshot during nuxt build', async () => {
    await ensureLocalModuleStub()
    await exec('nuxt', ['cleanup'], { nodeOptions: { cwd: fixtureDir } })
    const build = await exec('nuxt', ['build'], { nodeOptions: { cwd: fixtureDir } })
    expect(build.exitCode).toBe(0)

    const html = await readFile(resolve(fixtureDir, '.output/public/index.html'), 'utf-8')
    const ogImage = /<meta property="og:image" content="(.+?)">/.exec(html)?.[1]
    expect(ogImage).toBeTruthy()
    const image = await readFile(resolve(fixtureDir, `.output/public${decodeURIComponent(new URL(ogImage!).pathname)}`))
    const { format, width, height } = await sharp(image).metadata()
    expect({ format, width, height }).toEqual({ format: 'jpeg', width: 1200, height: 600 })
  }, 180000)
})
