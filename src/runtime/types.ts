import type { Buffer } from 'node:buffer'
import type { html } from 'satori-html'
import type { H3Error, H3Event } from 'h3'
import type { ResvgRenderOptions } from '@resvg/resvg-js'
import type { SatoriOptions } from 'satori'
export type IconifyEmojiIconSets = 'twemoji' | 'noto' | 'fluent-emoji' | 'fluent-emoji-flat' | 'fluent-emoji-high-contrast' | 'noto-v1' | 'emojione' | 'emojione-monotone' | 'emojione-v1' | 'fxemoji' | 'streamline-emojis' | 'openmoji'

export interface OgImageComponent {
  path?: string
  pascalName: string
  kebabName: string
  hash: string
  category: 'app' | 'official' | 'community' | 'pro'
  credits?: string
}

export interface ScreenshotOptions {
  colorScheme?: 'dark' | 'light'
  selector?: string
  mask?: string
  /**
   * The width of the screenshot.
   *
   * @default 1200
   */
  width: number
  /**
   * The height of the screenshot.
   *
   * @default 630
   */
  height: number
  /**
   * How long to wait before taking the screenshot. Useful for waiting for animations.
   */
  delay?: number
}

export type OgImagePrebuilt = { url: string } & Pick<OgImageOptions, 'width' | 'height' | 'alt'>

export type DefineOgImageInput = OgImageOptions | OgImagePrebuilt | false

export interface OgImageOptions extends Partial<ScreenshotOptions> {
  component?: string
  renderer?: 'chromium' | 'satori'
  extension?: 'png' | 'jpeg' | 'jpg'
  emojis?: IconifyEmojiIconSets
  /**
   * Provide a static HTML template to render the OG Image instead of a component.
   */
  html?: string
  // cache config
  cache?: boolean
  cacheKey?: string
  resvg?: ResvgRenderOptions
  satori?: SatoriOptions
  /**
   * The time to live of the cache in milliseconds.
   */
  cacheTtl?: number
  // deprecations
  // catch-all
  [key: string]: any
}

export interface RuntimeOgImageOptions extends Omit<OgImageOptions, 'extension'> {
  extension: 'png' | 'jpeg' | 'jpg' | 'svg' | 'json' | 'html'
  path: string
}

export interface FontConfig { name: string, weight: string | number, path?: string }

export type InputFontConfig = (`${string}:${number}` | FontConfig)

export type RendererOptions = Omit<RuntimeOgImageOptions, 'extension'> & { extension: Omit<RuntimeOgImageOptions['extension'], 'html'> }

export interface Renderer {
  name: 'chromium' | 'satori'
  supportedFormats: Partial<RendererOptions['extension']>[]
  createImage: (e: H3Event, options: RendererOptions) => Promise<H3Error | Buffer | string>
  debug: (e: H3Event, options: RendererOptions) => Promise<Record<string, any>>
}

export type OgImageScreenshotOptions = Omit<OgImageOptions, 'component'>

export type VNode = ReturnType<typeof html>

export interface SatoriTransformer {
  filter: (node: VNode) => boolean
  transform: (node: VNode, e: H3Event) => Promise<void>
}
