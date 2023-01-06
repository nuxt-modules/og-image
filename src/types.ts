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
  runtime?: boolean
  title?: string
  description?: string
  component?: string
  alt?: string
  [key: string]: any
}

export type OgImageScreenshotPayload = Omit<OgImagePayload, 'component' | 'runtime'>

export interface OgImageRouteEntry {
  route: string
  screenshotPath: string
  routeRules: string
  fileName: string
  absoluteUrl: string
  outputPath: string

  linkingHtml: string
  payload: OgImageScreenshotPayload | OgImagePayload
}

declare module 'nitropack' {
  interface NitroRouteRules {
    ogImage?: 'screenshot' | string | false
    ogImagePayload?: Record<string, any>
  }
}
