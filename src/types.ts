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

export interface OgImagePayload extends Partial<ScreenshotOptions> {
  provider?: 'browser' | 'satori'

  prerender?: boolean
  title?: string
  description?: string
  component?: string
  alt?: string
  [key: string]: any
}

export interface Provider {
  name: 'browser' | 'satori'
  createSvg: (path: string) => Promise<string>
  createPng: (path: string) => Promise<Buffer>
}

export type OgImageScreenshotPayload = Omit<OgImagePayload, 'component'>

declare module 'nitropack' {
  interface NitroRouteRules {
    ogImage?: false | OgImageScreenshotPayload | OgImagePayload
  }
}

export interface PlaygroundServerFunctions {
  openInEditor(filepath: string): void
  getConfig(): ModuleOptions
}

export interface PlaygroundClientFunctions {
  refresh(type: string): void
}
