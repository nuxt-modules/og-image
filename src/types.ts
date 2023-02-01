import type { html } from 'satori-html'
import type { ModuleOptions } from './module'

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

  static?: boolean
  title?: string
  description?: string
  component?: string
  alt?: string
  [key: string]: any
}

export interface Renderer {
  name: 'browser' | 'satori'
  createSvg: (path: string, options: OgImageOptions) => Promise<string>
  createPng: (path: string, options: OgImageOptions) => Promise<Buffer>
  createVNode: (path: string, options: OgImageOptions) => Promise<VNode>
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
  transform: (node: VNode) => Promise<void>
}
