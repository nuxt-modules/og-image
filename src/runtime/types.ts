import type { html } from 'satori-html'
import type { H3Error, H3Event } from 'h3'
import type { ResvgRenderOptions } from '@resvg/resvg-js'
import type { SatoriOptions } from 'satori'
import type { AllowedComponentProps, Component, ComponentCustomProps, VNodeProps } from '@vue/runtime-core'
import type { SharpOptions } from 'sharp'
import type { NitroApp, WasmOptions } from 'nitropack'
import type { OgImageComponents } from '#nuxt-og-image/components'

export interface OgImageRenderEventContext {
  e: H3Event
  extension: 'png' | 'jpeg' | 'jpg' | 'svg' | 'html' | 'json'
  key: string
  basePath: string
  renderer: Renderer
  options: OgImageOptions
  isDebugJsonPayload: boolean
  _nitro: NitroApp
}

export type IconifyEmojiIconSets = 'twemoji' | 'noto' | 'fluent-emoji' | 'fluent-emoji-flat' | 'fluent-emoji-high-contrast' | 'noto-v1' | 'emojione' | 'emojione-monotone' | 'emojione-v1' | 'streamline-emojis' | 'openmoji'

export interface OgImageRuntimeConfig {
  version: string
  satoriOptions: SatoriOptions
  resvgOptions: ResvgRenderOptions
  sharpOptions: SharpOptions

  defaults: OgImageOptions
  debug: boolean
  baseCacheKey: string
  fonts: FontConfig[]
  hasNuxtIcon: boolean
  colorPreference: 'light' | 'dark'
}

export interface OgImageComponent {
  path?: string
  pascalName: string
  kebabName: string
  hash: string
  category: 'app' | 'community' | 'pro'
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

export interface OgImageOptions<T extends keyof OgImageComponents = 'NuxtSeo'> {
  /**
   * The width of the screenshot.
   *
   * @default 1200
   */
  width?: number
  /**
   * The height of the screenshot.
   *
   * @default 630
   */
  height?: number
  /**
   * The alt text for the image.
   */
  alt?: string
  /**
   * Use a prebuilt image instead of generating one.
   *
   * Should be an absolute URL.
   */
  url?: string
  /**
   * The name of the component to render.
   */
  component?: T | string
  /**
   * Props to pass to the component.
   */
  props?: OgImageComponents[T] | Record<string, any>
  renderer?: 'chromium' | 'satori'
  extension?: 'png' | 'jpeg' | 'jpg'
  emojis?: IconifyEmojiIconSets
  /**
   * Provide a static HTML template to render the OG Image instead of a component.
   */
  html?: string
  // vendor config
  resvg?: ResvgRenderOptions
  satori?: SatoriOptions
  screenshot?: Partial<ScreenshotOptions>
  sharp?: SharpOptions
  fonts?: InputFontConfig[]
  // cache
  cacheMaxAgeSeconds?: number
  /**
   * @internal
   */
  _query?: Record<string, any>
}

export interface FontConfig { name: string, style?: string, weight?: string | number, path?: string, key?: string }
export interface ResolvedFontConfig extends FontConfig { cacheKey: string, data?: BufferSource }

export type InputFontConfig = (`${string}:${number}` | string | FontConfig)

export interface RuntimeCompatibilitySchema {
  chromium: 'node' | false
  ['css-inline']: 'node' | false
  resvg: 'node' | 'wasm' | 'wasm-fs' | false
  satori: 'node' | 'wasm' | 'wasm-fs' | false
  sharp: 'node' | false
  wasm?: WasmOptions
}

export type CompatibilityFlags = Partial<Omit<RuntimeCompatibilitySchema, 'wasm'>>

export interface CompatibilityFlagEnvOverrides {
  dev?: CompatibilityFlags
  runtime?: CompatibilityFlags
  prerender?: CompatibilityFlags
}

export type RendererOptions = Omit<OgImageOptions, 'extension'> & { extension: Omit<OgImageOptions['extension'], 'html'> }

export interface Renderer {
  name: 'chromium' | 'satori'
  supportedFormats: Partial<RendererOptions['extension']>[]
  createImage: (e: OgImageRenderEventContext) => Promise<H3Error | BufferSource | void>
  debug: (e: OgImageRenderEventContext) => Promise<Record<string, any>>
}

export type ExtractComponentProps<T extends Component> = T extends new (...args: any) => any
  ? Omit<InstanceType<T>['$props'], keyof ComponentCustomProps | keyof VNodeProps | keyof AllowedComponentProps>
  : never

export type OgImagePageScreenshotOptions = Omit<OgImageOptions, 'html' | 'renderer' | 'component' | 'satori' | 'resvg' | 'sharp'>

export type VNode = ReturnType<typeof html>

export interface SatoriTransformer {
  filter: (node: VNode) => boolean
  transform: (node: VNode, e: OgImageRenderEventContext) => Promise<void>
}
