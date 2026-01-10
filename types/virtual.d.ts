declare module '#og-image/components' {
  import type { Component } from 'vue'

  const components: Record<string, Component>
  export default components
}
declare module '#og-image/renderers/satori' {
  import type Renderer from '#og-image/types'

  const renderer: Renderer | { __mock__: true } | undefined
  export default renderer
}
declare module '#og-image/renderers/chromium' {
  import type Renderer from '#og-image/types'

  const renderer: Renderer | { __mock__: true } | undefined
  export default renderer
}

declare module '#og-image/bindings/satori' {
  const satori: typeof import('satori').satori
  export default satori
}

declare module '#og-image/bindings/resvg' {
  interface WasmResvg {
    initWasmPromise: Promise<void>
    Resvg: import('resvg').Resvg
  }
  const instance: WasmResvg
  export default instance
}
declare module '#og-image/bindings/chromium' {
  export const createBrowser: () => Promise<Browser | void>
}

declare module '#og-image/bindings/css-inline' {
  import type _CssInline from 'css-inline'

  const cssInline: _CssInline
  export default cssInline
}

declare module '#og-image/bindings/sharp' {
  import type _sharp from 'sharp'

  const sharp: _sharp
  export default sharp
}

declare module '#og-image-virtual/component-names.mjs' {
  const componentNames: string[]
  export default componentNames
}

declare module '#og-image-virtual/unocss-config.mjs' {
  export const theme: Record<string, any>
}

declare module '#og-image-cache' {
  import type { OgImageOptions } from '#og-image/types'
  import type { Storage } from 'unstorage'

  export const htmlPayloadCache: Storage<{ expiresAt: number, value: OgImageOptions }>

  export const prerenderOptionsCache: Storage<OgImageOptions> | undefined

  export const fontCache: Storage<BufferSource> | undefined

  export const emojiCache: Storage<string>
}

declare module '@css-inline/css-inline-wasm' {
  export function inline(css: string, html: string): string
  export default function init(): Promise<void>
  const cssInline: {
    inline: (css: string, html: string) => string
  }
  export { cssInline }
}
