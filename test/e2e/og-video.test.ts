import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createResolver } from '@nuxt/kit'
import { $fetch, fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

let hasFfmpeg = true
try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
}
catch {
  hasFfmpeg = false
}
// CI sets HAS_FFMPEG on the job that installs ffmpeg, so a missing binary fails there instead of skipping.
const runVideoTests = hasFfmpeg || !!process.env.HAS_FFMPEG

// The fixture prerenders an og:video, so its build needs ffmpeg.
if (runVideoTests) {
  await setup({
    rootDir: resolve('../fixtures/og-video'),
    server: true,
    build: true,
  })
}

function metaContent(html: string, property: string) {
  return html.match(new RegExp(`<meta property="${property}" content="([^"]+)"`))?.[1]?.replaceAll('&amp;', '&')
}

function localPath(url: string) {
  const { pathname, search } = new URL(url)
  return pathname + search
}

async function fetchVideo(page: string) {
  const video = metaContent(await $fetch<string>(page), 'og:video')
  if (!video)
    throw new Error(`${page} has no og:video`)
  return fetch(localPath(video))
}

const PROBE_WIDTH = 120
const PROBE_HEIGHT = 60

/**
 * Decode the video to small gray frames and return the frame count and the largest mean
 * pixel difference from the first frame, on a 0 to 255 scale. Lossy encoding moves a
 * still frame by well under one level; an animation moves it by several.
 */
function measureMotion(mp4: Uint8Array) {
  // `+faststart` puts the index first, so ffmpeg reads the MP4 from stdin and no temp file is left behind.
  const pixels = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', 'pipe:0', '-vf', `scale=${PROBE_WIDTH}:${PROBE_HEIGHT},format=gray`, '-f', 'rawvideo', '-'], { input: mp4, maxBuffer: 64 * 1024 * 1024 })
  const size = PROBE_WIDTH * PROBE_HEIGHT
  const frames = pixels.byteLength / size
  let motion = 0
  for (let frame = 1; frame < frames; frame++) {
    let diff = 0
    for (let i = 0; i < size; i++)
      diff += Math.abs(pixels[frame * size + i]! - pixels[i]!)
    motion = Math.max(motion, diff / size)
  }
  return { frames, motion }
}

describe.runIf(runVideoTests)('og:video', () => {
  it('emits og:video next to og:image', async () => {
    const html = await $fetch<string>('/invite/AB12')
    const image = metaContent(html, 'og:image')
    expect(image).toMatch(/\.png$/)
    expect(metaContent(html, 'og:video')).toBe(image!.replace(/\.png$/, '.mp4'))
    expect(metaContent(html, 'og:video:type')).toBe('video/mp4')
  })

  it('renders the template animation to an H.264 mp4', async () => {
    const res = await fetchVideo('/invite/AB12')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('video/mp4')
    const bytes = Buffer.from(await res.arrayBuffer())
    // ISO BMFF: `ftyp` box at offset 4, and `+faststart` puts `moov` before `mdat`
    expect(bytes.subarray(4, 8).toString()).toBe('ftyp')
    expect(bytes.indexOf('moov')).toBeLessThan(bytes.indexOf('mdat'))
  }, 60_000)

  it('animates Tailwind animate-* classes', async () => {
    const res = await fetchVideo('/invite/AB12')
    const { frames, motion } = measureMotion(new Uint8Array(await res.arrayBuffer()))
    expect(frames).toBe(60)
    expect(motion).toBeGreaterThan(2)
  }, 60_000)

  it('renders a template without animations to still frames', async () => {
    const res = await fetchVideo('/still-video')
    const { frames, motion } = measureMotion(new Uint8Array(await res.arrayBuffer()))
    expect(frames).toBe(5)
    expect(motion).toBeLessThan(1)
  }, 60_000)

  it('renders an empty video options object at the default settings', async () => {
    const res = await fetchVideo('/empty-video')
    expect(res.headers.get('content-type')).toBe('video/mp4')
    // 3 seconds at 30 fps
    expect(measureMotion(new Uint8Array(await res.arrayBuffer())).frames).toBe(90)
  }, 60_000)

  it('animates keyframes passed through takumi.css', async () => {
    const res = await fetchVideo('/float')
    const { frames, motion } = measureMotion(new Uint8Array(await res.arrayBuffer()))
    expect(frames).toBe(10)
    expect(motion).toBeGreaterThan(2)
  }, 60_000)

  it('keeps the image and the video of one URL apart in the cache', async () => {
    const html = await $fetch<string>('/invite/CACHE')
    const png = await fetch(localPath(metaContent(html, 'og:image')!))
    expect(png.headers.get('content-type')).toBe('image/png')
    const mp4 = await fetch(localPath(metaContent(html, 'og:video')!))
    expect(mp4.headers.get('content-type')).toBe('video/mp4')
    expect(Buffer.from(await mp4.arrayBuffer()).subarray(4, 8).toString()).toBe('ftyp')
  }, 60_000)

  it('answers byte-range requests on a cache miss and a cache hit', async () => {
    const video = localPath(metaContent(await $fetch<string>('/invite/RANGE'), 'og:video')!)
    for (const attempt of ['miss', 'hit']) {
      const res = await fetch(video, { headers: { range: 'bytes=0-1' } })
      expect(res.status, attempt).toBe(206)
      expect(res.headers.get('content-range'), attempt).toMatch(/^bytes 0-1\/\d+$/)
      expect(res.headers.get('accept-ranges'), attempt).toBe('bytes')
      expect((await res.arrayBuffer()).byteLength, attempt).toBe(2)
    }
    const full = await fetch(video)
    expect(full.status).toBe(200)
    const size = Number((await fetch(video, { headers: { range: 'bytes=0-0' } })).headers.get('content-range')!.split('/')[1])
    expect((await full.arrayBuffer()).byteLength).toBe(size)
  }, 60_000)

  it('rejects an mp4 request for an image without video', async () => {
    const html = await $fetch<string>('/still')
    expect(metaContent(html, 'og:video')).toBeUndefined()
    const res = await fetch(localPath(metaContent(html, 'og:image')!).replace(/\.png(?=$|\?)/, '.mp4'))
    expect(res.status).toBe(400)
  })

  it('omits og:video for a renderer that cannot render video', async () => {
    const html = await $fetch<string>('/satori')
    expect(metaContent(html, 'og:video')).toBeUndefined()
    // defineOgImage() returns the same image URL that the meta tag carries.
    const returned = html.match(/<p id="og-path">\s*([^<\s]+)\s*<\/p>/)?.[1]?.replaceAll('&amp;', '&')
    expect(returned).toBeDefined()
    expect(new URL(metaContent(html, 'og:image')!).pathname).toBe(returned!.split('?')[0])
  })

  it('prerenders the video next to the image', async () => {
    const html = await $fetch<string>('/invite/GR8F')
    const video = new URL(metaContent(html, 'og:video')!)
    expect(video.pathname).toMatch(/^\/_og\/s\/.+\.mp4$/)
    // The prerender moves the video to the configured CDN, like the image.
    expect(video.origin).toBe('https://cdn.example.com')
    expect(new URL(metaContent(html, 'og:image')!).origin).toBe('https://cdn.example.com')
    expect(new URL(metaContent(html, 'og:video:secure_url')!).origin).toBe('https://cdn.example.com')
    const { buildDir } = useTestContext().nuxt!.options
    expect(existsSync(join(buildDir, 'output', 'public', video.pathname))).toBe(true)
    const res = await fetch(video.pathname)
    expect(Buffer.from(await res.arrayBuffer()).subarray(4, 8).toString()).toBe('ftyp')
  })

  it('fetches a template image once per video, not once per frame', async () => {
    const before = (await $fetch<{ hits: number }>('/logo-hits')).hits
    const res = await fetchVideo('/logo/runtime')
    expect(res.headers.get('content-type')).toBe('video/mp4')
    const { frames } = measureMotion(new Uint8Array(await res.arrayBuffer()))
    expect(frames).toBe(10)
    expect((await $fetch<{ hits: number }>('/logo-hits')).hits - before).toBe(1)
  }, 60_000)
})
