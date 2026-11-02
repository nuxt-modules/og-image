import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createResolver } from '@nuxt/kit'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

let hasFfmpeg = true
try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
}
catch {
  hasFfmpeg = false
}

await setup({
  rootDir: resolve('../fixtures/og-video'),
  server: true,
  build: true,
})

describe.runIf(hasFfmpeg)('og:video', () => {
  it('emits og:video next to og:image', async () => {
    const html = await $fetch('/invite/AB12') as string
    const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]
    const video = html.match(/<meta property="og:video" content="([^"]+)"/)?.[1]
    expect(image).toMatch(/\.png$/)
    expect(video).toBe(image!.replace(/\.png$/, '.mp4'))
    expect(html).toContain('<meta property="og:video:type" content="video/mp4">')
  })

  it('renders the template animation to an H.264 mp4', async () => {
    const html = await $fetch('/invite/AB12') as string
    const video = html.match(/<meta property="og:video" content="([^"]+)"/)![1]!
    const res = await fetch(new URL(video.replaceAll('&amp;', '&')).pathname)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('video/mp4')
    const bytes = Buffer.from(await res.arrayBuffer())
    // ISO BMFF: `ftyp` box at offset 4, and `+faststart` puts `moov` before `mdat`
    expect(bytes.subarray(4, 8).toString()).toBe('ftyp')
    expect(bytes.indexOf('moov')).toBeLessThan(bytes.indexOf('mdat'))
  }, 60000)

  it('animates keyframes passed through takumi.css', async () => {
    const html = await $fetch('/float') as string
    const video = html.match(/<meta property="og:video" content="([^"]+)"/)![1]!
    const res = await fetch(new URL(video.replaceAll('&amp;', '&')).pathname)
    const file = join(mkdtempSync(join(tmpdir(), 'og-video-')), 'float.mp4')
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
    const hashes = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-f', 'framemd5', '-'], { encoding: 'utf8' })
      .split('\n')
      .filter(line => line && !line.startsWith('#'))
      .map(line => line.split(',').pop()!.trim())
    expect(hashes).toHaveLength(10)
    expect(new Set(hashes).size).toBeGreaterThan(1)
  }, 60000)
})
