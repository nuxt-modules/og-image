import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { createMp4Encoder, resolveVideoOptions, videoFrameTimes } from '../../src/runtime/server/og-image/takumi/video'
import { decodeOgImageParams, encodeOgImageParams, generateMeta } from '../../src/runtime/shared'

let hasFfmpeg = true
try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
}
catch {
  hasFfmpeg = false
}
// CI sets HAS_FFMPEG on the job that installs ffmpeg, so a missing binary fails there instead of skipping.
const runFfmpegTests = hasFfmpeg || !!process.env.HAS_FFMPEG

describe('resolveVideoOptions', () => {
  it.each([
    ['true', true, { durationMs: 3000, fps: 30 }],
    ['null', null, { durationMs: 3000, fps: 30 }],
    ['values in range', { durationMs: 2000, fps: 24 }, { durationMs: 2000, fps: 24 }],
    ['values above the caps', { durationMs: 60_000, fps: 240 }, { durationMs: 10_000, fps: 60 }],
    ['values below the floor', { durationMs: 10, fps: -5 }, { durationMs: 100, fps: 1 }],
    ['non-numeric values', { durationMs: 'long', fps: 'fast' }, { durationMs: 3000, fps: 30 }],
  ])('bounds %s', (_, input, expected) => {
    expect(resolveVideoOptions(input as any)).toEqual(expected)
  })
})

describe('video URL encoding', () => {
  it('keeps an empty video options object as an opt-in', () => {
    expect(decodeOgImageParams(encodeOgImageParams({ video: {} })).video).toBe(true)
  })

  it('keeps video settings', () => {
    expect(decodeOgImageParams(encodeOgImageParams({ video: { durationMs: 2000 } })).video).toEqual({ durationMs: 2000 })
  })
})

describe('videoFrameTimes', () => {
  it('places one frame per fps tick in whole milliseconds', () => {
    expect(videoFrameTimes({ durationMs: 100, fps: 30 })).toEqual([0, 33, 67])
  })

  it('renders at least one frame', () => {
    expect(videoFrameTimes({ durationMs: 100, fps: 1 })).toEqual([0])
  })
})

describe('generateMeta with video', () => {
  const url = 'https://example.com/_og/s/o_abc.png'
  const options = { width: 1200, height: 600, extension: 'png' as const }

  function contentOf(meta: ReturnType<typeof generateMeta>, property: string) {
    const tag = meta.find(m => 'property' in m && m.property === property)
    return tag && (typeof tag.content === 'function' ? tag.content() : tag.content)
  }

  it('points og:video at the mp4 rendition of the image', () => {
    const meta = generateMeta(url, { ...options, video: true })
    expect(contentOf(meta, 'og:video')).toBe('https://example.com/_og/s/o_abc.mp4')
    expect(contentOf(meta, 'og:video:type')).toBe('video/mp4')
    expect(contentOf(meta, 'og:video:width')).toBe(1200)
  })

  it('emits no og:video without the video option', () => {
    expect(contentOf(generateMeta(url, options), 'og:video')).toBeUndefined()
  })

  it('emits no og:video for a prebuilt image url', () => {
    const prebuilt = { url: 'https://cdn.example.com/card.png', video: true } as any
    expect(contentOf(generateMeta('https://cdn.example.com/card.png', prebuilt), 'og:video')).toBeUndefined()
  })

  it('emits no og:video for the twitter key', () => {
    expect(contentOf(generateMeta(url, { ...options, video: true, key: 'twitter' }), 'og:video')).toBeUndefined()
  })
})

describe('createMp4Encoder', () => {
  const frame = new Uint8Array(4 * 4 * 4).fill(255)

  it('names the fix when the ffmpeg binary is missing', async () => {
    const encoder = await createMp4Encoder({ ffmpeg: '/nonexistent/ffmpeg', width: 4, height: 4, fps: 1, signal: new AbortController().signal })
    await expect(encoder.finish()).rejects.toThrow('NUXT_OG_IMAGE_FFMPEG')
  })

  it.runIf(runFfmpegTests)('encodes raw RGBA frames to an mp4', async () => {
    const encoder = await createMp4Encoder({ ffmpeg: 'ffmpeg', width: 4, height: 4, fps: 1, signal: new AbortController().signal })
    await encoder.write(frame)
    await encoder.write(frame)
    const mp4 = await encoder.finish()
    expect(new TextDecoder().decode(mp4.subarray(4, 8))).toBe('ftyp')
  })

  it.runIf(runFfmpegTests)('stops ffmpeg when the render times out', async () => {
    const controller = new AbortController()
    const encoder = await createMp4Encoder({ ffmpeg: 'ffmpeg', width: 4, height: 4, fps: 1, signal: controller.signal })
    await encoder.write(frame)
    controller.abort()
    await expect(encoder.finish()).rejects.toMatchObject({ name: 'AbortError' })
  })
})
