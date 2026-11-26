import { readFile } from 'node:fs/promises'
import { createResolver } from '@nuxt/kit'
import { exec } from 'tinyexec'
import { beforeAll, describe, expect, it } from 'vitest'
import { ensureLocalModuleStub } from '../utils'

const { resolve } = createResolver(import.meta.url)

const fixtureDir = resolve('../fixtures/hash-mode')

async function ogImageOf(page: string) {
  const html = await readFile(resolve(fixtureDir, `.output/public/${page}/index.html`), 'utf-8')
  return /<meta property="og:image" content="(.+?)">/.exec(html)?.[1]
}

async function imageFileOf(page: string) {
  const url = await ogImageOf(page)
  expect(url).toMatch(/\/_og\/s\/o_[a-z0-9]+\.png$/)
  return readFile(resolve(fixtureDir, `.output/public${new URL(url!).pathname}`))
}

describe('hash mode', () => {
  beforeAll(async () => {
    await ensureLocalModuleStub()
    await exec('nuxt', ['cleanup'], { nodeOptions: { cwd: fixtureDir } })
    await exec('nuxt', ['build'], { nodeOptions: { cwd: fixtureDir } })
  }, 180000)

  it('shares one image between pages with identical options', async () => {
    const one = await ogImageOf('card/one')
    expect(one).toMatch(/\/_og\/s\/o_[a-z0-9]+\.png$/)
    expect(await ogImageOf('card/two')).toBe(one)
    await expect(readFile(resolve(fixtureDir, `.output/public${new URL(one!).pathname}`))).resolves.toBeTruthy()
  })

  it('gives a route rule page its own image', async () => {
    expect(await ogImageOf('card/rule')).not.toBe(await ogImageOf('card/one'))
  })

  it('renders the head title and description when props are empty', async () => {
    expect(await ogImageOf('seo/inferred')).not.toBe(await ogImageOf('seo/explicit'))
    expect((await imageFileOf('seo/inferred')).equals(await imageFileOf('seo/explicit'))).toBe(true)
  })

  it('keeps the component default title when only useHead sets a title', async () => {
    expect(await ogImageOf('seo/head-title')).not.toBe(await ogImageOf('seo/default'))
    expect((await imageFileOf('seo/head-title')).equals(await imageFileOf('seo/default'))).toBe(true)
  })

  it('gives each page screenshot its own image', async () => {
    expect(await ogImageOf('shot/alpha')).not.toBe(await ogImageOf('shot/bravo'))
  })
})
