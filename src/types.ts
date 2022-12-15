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
}

export interface OgImageRouteEntry {
  route: string
  screenshotPath: string
  routeRules: string
  fileName: string
  absoluteUrl: string
  outputPath: string
}

declare module 'nitropack' {
  interface NitroRouteRules {
    ogImage?: 'screenshot' | string | false
    ogImagePayload?: Record<string, any>
  }
}
