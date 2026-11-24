import type { OgImageOptions, OgImageVideoOptions } from '../../../types'

export const MAX_VIDEO_DURATION_MS = 10_000
export const MAX_VIDEO_FPS = 60

/**
 * Bound the `video` option from the image URL. An unsigned URL can carry any value,
 * so each field falls back to its default or clamps to the documented range.
 */
export function resolveVideoOptions(video: OgImageOptions['video']): Required<OgImageVideoOptions> {
  const options: OgImageVideoOptions = video && typeof video === 'object' ? video : {}
  return {
    durationMs: Math.min(Math.max(Number(options.durationMs) || 3000, 100), MAX_VIDEO_DURATION_MS),
    fps: Math.min(Math.max(Math.round(Number(options.fps)) || 30, 1), MAX_VIDEO_FPS),
  }
}

/** The timeline position of each frame, in whole milliseconds, which is what Takumi accepts. */
export function videoFrameTimes({ durationMs, fps }: Required<OgImageVideoOptions>): number[] {
  const count = Math.max(1, Math.round(durationMs / 1000 * fps))
  return Array.from({ length: count }, (_, i) => Math.round(i * 1000 / fps))
}

export interface Mp4EncoderOptions {
  /** The ffmpeg binary to run. */
  ffmpeg: string
  width: number
  height: number
  fps: number
  /** Aborting it stops ffmpeg. */
  signal: AbortSignal
}

/**
 * Stream raw RGBA frames into `ffmpeg` and get back an H.264 MP4.
 * Output goes to a temp file because `+faststart` needs a seekable output, and
 * Messages only plays MP4s it can stream from the start.
 */
export async function createMp4Encoder({ ffmpeg: bin, width, height, fps, signal }: Mp4EncoderOptions) {
  // Edge presets bundle this renderer but cannot spawn processes, so the Node builtins load only for a video render.
  const [{ spawn }, { mkdtemp, readFile, rm }, { tmpdir }, { join }] = await Promise.all([
    import('node:child_process'),
    import('node:fs/promises'),
    import('node:os'),
    import('node:path'),
  ])
  signal.throwIfAborted()
  const dir = await mkdtemp(join(tmpdir(), 'nuxt-og-image-'))
  const output = join(dir, 'og.mp4')
  const ffmpeg = spawn(bin, [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'rawvideo',
    '-pixel_format',
    'rgba',
    '-video_size',
    `${width}x${height}`,
    '-framerate',
    String(fps),
    '-i',
    'pipe:0',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    output,
  ], { stdio: ['pipe', 'ignore', 'pipe'], signal })
  let stderr = ''
  ffmpeg.stderr.on('data', (chunk) => {
    stderr += chunk
  })
  // A write after ffmpeg exits fails with EPIPE. `exited` already reports why ffmpeg stopped.
  ffmpeg.stdin.on('error', (err) => {
    void err
  })
  let failure: Error | undefined
  const exited = new Promise<void>((resolve, reject) => {
    ffmpeg.on('error', (err) => {
      failure ||= err.name === 'AbortError'
        ? err
        : new Error(`[Nuxt OG Image] Could not run ffmpeg for og:video: ${err.message}. Install ffmpeg, or set NUXT_OG_IMAGE_FFMPEG to its path.`)
      reject(failure)
    })
    ffmpeg.on('close', (code) => {
      if (code === 0)
        return resolve()
      failure ||= new Error(`[Nuxt OG Image] ffmpeg exited with code ${code}: ${stderr.trim()}`)
      reject(failure)
    })
  })
  // write() and finish() rethrow the failure. This handler only prevents an unhandled rejection.
  exited.catch((err) => {
    void err
  })
  const removeDir = () => rm(dir, { recursive: true, force: true })

  return {
    async write(frame: Uint8Array) {
      if (failure)
        throw failure
      if (!ffmpeg.stdin.write(frame))
        await Promise.race([new Promise(resolve => ffmpeg.stdin.once('drain', resolve)), exited])
    },
    async finish(): Promise<Uint8Array> {
      ffmpeg.stdin.end()
      try {
        await exited
        return new Uint8Array(await readFile(output))
      }
      finally {
        await removeDir()
      }
    },
    /** Stop ffmpeg after a failed render and remove its output. */
    async abort() {
      ffmpeg.kill()
      await exited.catch((err) => {
        // The caller already holds the error that caused the abort.
        void err
      })
      await removeDir()
    },
  }
}
