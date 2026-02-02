import type { OgImageComponents } from '#og-image/components'
import type { ResvgRenderOptions } from '@resvg/resvg-js'
import type { AllowedComponentProps, Component, ComponentCustomProps, VNodeProps } from '@vue/runtime-core'
import type { H3Error, H3Event } from 'h3'
import type { Hookable } from 'hookable'
import type { NitroRuntimeHooks } from 'nitropack/types'
import type { SatoriOptions } from 'satori'
import type { JpegOptions, SharpOptions } from 'sharp'
import type { Ref } from 'vue'

interface NitroApp {
  hooks: Hookable<NitroRuntimeHooks>
  [key: string]: any
}

export interface OgImageRenderEventContext {
  e: H3Event
  extension: 'png' | 'jpeg' | 'jpg' | 'svg' | 'html' | 'json'
  key: string
  basePath: string
  renderer: Renderer
  options: OgImageOptions
  isDevToolsContextRequest: boolean
  publicStoragePath: string
  runtimeConfig: OgImageRuntimeConfig
  _nitro: NitroApp
}

export type IconifyEmojiIconSets = 'twemoji' | 'noto' | 'fluent-emoji' | 'fluent-emoji-flat' | 'fluent-emoji-high-contrast' | 'noto-v1' | 'emojione' | 'emojione-monotone' | 'emojione-v1' | 'streamline-emojis' | 'openmoji'

export type EmojiStrategy = 'auto' | 'local' | 'fetch'

export interface OgImageRuntimeConfig {
  version: string
  satoriOptions: SatoriOptions
  resvgOptions: ResvgRenderOptions
  sharpOptions: SharpOptions

  publicStoragePath: string

  defaults: OgImageOptions
  debug: boolean
  baseCacheKey: string
  hasNuxtIcon: boolean
  hasNuxtContent?: boolean
  colorPreference: 'light' | 'dark'

  isNuxtContentDocumentDriven: boolean
  zeroRuntime: boolean
  cacheQueryParams: boolean
  cssFramework: 'tailwind' | 'unocss' | 'none'

  componentDirs?: string[]
  /** Directory for persistent build cache (CI caching) */
  buildCacheDir?: string
  /** Source directory for auto-eject (dev only) */
  srcDir?: string
  /** Path to community templates (dev only) */
  communityTemplatesDir?: string

  app: {
    baseURL: string
  }
}

export type RendererType = 'satori' | 'chromium' | 'takumi'

export interface OgImageComponent {
  path?: string
  pascalName: string
  kebabName: string
  hash: string
  category: 'app' | 'community' | 'pro'
  credits?: string
  renderer: RendererType
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

export interface OgImagePrebuilt extends OgImageOptions {
}

export type DefineOgImageInput = OgImageOptions | OgImagePrebuilt | false

export interface OgImageOptions<T extends keyof OgImageComponents = keyof OgImageComponents> {
  /**
   * The width of the screenshot.
   *
   * @default 1200
   */
  width?: number | (() => number) | Ref<number>
  /**
   * The height of the screenshot.
   *
   * @default 630
   */
  height?: number | (() => number) | Ref<number>
  /**
   * The alt text for the image.
   */
  alt?: string | (() => string) | Ref<string>
  /**
   * Use a prebuilt image instead of generating one.
   *
   * Should be an absolute URL.
   */
  url?: string | (() => string) | Ref<string>
  /**
   * The name of the component to render.
   */
  component?: T | string
  /**
   * Props to pass to the component.
   */
  props?: OgImageComponents[T] | Record<string, any>
  /**
   * Override renderer. Only used internally for screenshots.
   * For normal usage, renderer is determined by component filename suffix.
   * @internal
   */
  renderer?: RendererType
  extension?: 'png' | 'jpeg' | 'jpg' | 'svg' | 'html'
  emojis?: IconifyEmojiIconSets | false
  /**
   * Provide a static HTML template to render the OG Image instead of a component.
   */
  html?: string
  // vendor config
  resvg?: ResvgRenderOptions
  satori?: SatoriOptions
  screenshot?: Partial<ScreenshotOptions>
  sharp?: SharpOptions & JpegOptions
  takumi?: {
    format?: 'png' | 'jpeg' | 'webp'
    persistentImages?: Array<{ src: string, data: ArrayBuffer }>
  }
  // cache
  cacheMaxAgeSeconds?: number
  /**
   * Social preview metadata
   * @internal
   */
  socialPreview?: SocialPreviewMetaData
  /**
   * @internal
   */
  _query?: Record<string, any>
  /**
   * Hash for cache lookup when URL is too long for filesystem
   * @internal
   */
  _hash?: string
  /**
   * Allow multiple og images to be generated for the same route by setting a unique key.
   */
  key?: string
  /**
   * Custom cache key for this OG image.
   *
   * When set, this key is used directly for caching instead of the auto-generated key.
   */
  cacheKey?: string
}

export interface FontConfig {
  family: string
  weight: number
  style: 'normal' | 'italic'
  src: string
  localPath: string
}

export interface SatoriFontConfig extends FontConfig {
  cacheKey: string
  name: string
  data: BufferSource
}

export interface RuntimeCompatibilitySchema {
  chromium: 'chrome-launcher' | 'on-demand' | 'playwright' | false
  ['css-inline']: 'node' | 'wasm' | 'wasm-fs' | false
  resvg: 'node' | 'node-dev' | 'wasm' | 'wasm-fs' | 'wasm-edge' | false
  satori: 'node' | 'wasm' | '0-15-wasm' | 'wasm-fs' | 'wasm-edge' | false
  takumi: 'node' | 'wasm' | false
  sharp: 'node' | false
  // emoji strategy: 'local' bundles icons (24MB), 'fetch' uses iconify API at runtime
  emoji?: 'local' | 'fetch'
  wasm?: any
}

export type CompatibilityFlags = Partial<Omit<RuntimeCompatibilitySchema, 'wasm'>>

export interface CompatibilityFlagEnvOverrides {
  dev?: CompatibilityFlags
  runtime?: CompatibilityFlags
  prerender?: CompatibilityFlags
}

export type RendererOptions = Omit<OgImageOptions, 'extension'> & { extension: Omit<OgImageOptions['extension'], 'html'> }

export interface Renderer {
  name: 'chromium' | 'satori' | 'takumi'
  supportedFormats: Partial<RendererOptions['extension']>[]
  createImage: (e: OgImageRenderEventContext) => Promise<H3Error | BufferSource | Buffer | Uint8Array | void | undefined>
  debug: (e: OgImageRenderEventContext) => Promise<Record<string, any>>
}

export type ExtractComponentProps<T extends Component> = T extends new (...args: any) => any
  ? Omit<InstanceType<T>['$props'], keyof ComponentCustomProps | keyof VNodeProps | keyof AllowedComponentProps>
  : never

export type OgImagePageScreenshotOptions = Omit<OgImageOptions, 'html' | 'component' | 'satori' | 'resvg' | 'sharp'>

export interface VNode {
  type: string
  props: {
    style?: Record<string, any>
    children?: string | (VNode | string | null)[]
    [key: string]: any
  }
  _emojiMatches?: RegExpMatchArray | null
}

export interface SatoriTransformer {
  filter: (node: VNode) => boolean
  transform: (node: VNode, e: OgImageRenderEventContext) => Promise<void> | void
}

export interface DevToolsMetaDataExtraction {
  key: string
  twitter?: Record<string, string>
  og?: Record<string, string>
}

export interface SocialPreviewMetaData {
  twitter?: Record<string, string>
  og?: Record<string, string> & {
    image?: string | {
      'image:width'?: string | number
      'image:height'?: string | number
      [key: string]: any
    }
  }
}

export interface RouteRulesOgImage extends Partial<OgImageOptions> {
  // Allow for route rules to disable og:image by setting to false
  [key: string]: any
}
