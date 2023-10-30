import type { Buffer } from 'node:buffer'
import type { html } from 'satori-html'
import type { ModuleOptions } from '../module'

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

export interface OgImageOptions extends Partial<ScreenshotOptions> {
  provider?: 'browser' | 'satori'
  /**
   * Provide a static HTML template to render the OG Image instead of a component.
   */
  html?: string
  title?: string
  description?: string
  component?: string | null
  alt?: string
  // cache config
  cache?: boolean
  cacheKey?: string
  /**
   * The time to live of the cache in milliseconds.
   */
  cacheTtl?: number
  // deprecations
  /**
   * @deprecated Use `cache` instead
   */
  static?: boolean
  // catch-all
  [key: string]: any
}

export interface RuntimeOgImageOptions extends OgImageOptions {
  path: string
  requestOrigin: string
}

export interface FontConfig { name: string; weight: number; path?: string }

export type InputFontConfig = (`${string}:${number}` | FontConfig)

export interface Renderer {
  name: 'browser' | 'satori'
  createSvg: (options: RuntimeOgImageOptions) => Promise<string>
  createPng: (options: RuntimeOgImageOptions) => Promise<Buffer>
  createVNode: (options: RuntimeOgImageOptions) => Promise<VNode>
}

export type OgImageScreenshotOptions = Omit<OgImageOptions, 'component'>

export interface PlaygroundServerFunctions {
  openInEditor(filepath: string): void
  getConfig(): ModuleOptions
}

export interface PlaygroundClientFunctions {
  refresh(type: string): void
}

export type VNode = ReturnType<typeof html>

export interface SatoriTransformer {
  filter: (node: VNode) => boolean
  transform: (node: VNode, props: RuntimeOgImageOptions) => Promise<void>
}
