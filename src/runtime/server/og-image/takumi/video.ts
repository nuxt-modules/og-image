import type { OgImageOptions, OgImageVideoOptions } from '../../../types'

export function resolveVideoOptions(video: OgImageOptions['video']): Required<OgImageVideoOptions> {
  const options = typeof video === 'object' ? video : {}
  return {
    durationMs: Math.min(Math.max(Number(options.durationMs) || 3000, 100), 10_000),
    fps: Math.min(Math.max(Number(options.fps) || 30, 1), 60),
  }
}

/**
 * Stream raw RGBA frames into the system `ffmpeg` and get back an H.264 MP4.
 * Output goes to a temp file because `+faststart` needs a seekable output, and
 * Messages only plays MP4s it can stream from the start.
 */
export async function createMp4Encoder({ width, height, fps }: { width: number, height: number, fps: number }) {
  const [{ spawn }, { mkdtemp, readFile, rm }, { tmpdir }, { join }] = await Promise.all([
    import('node:child_process'),
    import('node:fs/promises'),
    import('node:os'),
    import('node:path'),
  ])
  const dir = await mkdtemp(join(tmpdir(), 'nuxt-og-image-'))
  const output = join(dir, 'og.mp4')
  const ffmpeg = spawn(process.env.NUXT_OG_IMAGE_FFMPEG || 'ffmpeg', [
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
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    output,
  ], { stdio: ['pipe', 'ignore', 'pipe'] })
  let stderr = ''
  ffmpeg.stderr.on('data', (chunk) => {
    stderr += chunk
  })
  const exited = new Promise<void>((resolve, reject) => {
    ffmpeg.on('error', err => reject(new Error(`[Nuxt OG Image] Could not run ffmpeg for og:video: ${err.message}`)))
    ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error(`[Nuxt OG Image] ffmpeg exited with ${code}: ${stderr}`)))
  })
  exited.catch((err) => {
    // write() and finish() await `exited` and rethrow; this only stops an unhandled rejection.
    void err
  })

  return {
    async write(frame: Uint8Array) {
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
        await rm(dir, { recursive: true, force: true })
      }
    },
    abort() {
      ffmpeg.kill()
      void rm(dir, { recursive: true, force: true })
    },
  }
}
