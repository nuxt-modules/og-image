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
