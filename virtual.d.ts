declare module '#nuxt-og-image/components' {
  import type { Component } from 'vue'

  const components: Record<string, Component>
  export default components
}
declare module '#nuxt-og-image/renderers/satori' {
  import type Renderer from './src/runtime/types'

  const renderer: Renderer | { __unenv__: true } | undefined
  export default renderer
}
declare module '#nuxt-og-image/renderers/chromium' {
  import type Renderer from './src/runtime/types'

  const renderer: Renderer | { __unenv__: true } | undefined
  export default renderer
}

declare module '#nuxt-og-image/bindings/satori' {
  const satori: typeof import('satori').satori
  export default satori
}

declare module '#nuxt-og-image/bindings/resvg' {
  interface WasmResvg {
    initWasmPromise: Promise<void>
    Resvg: import('resvg').Resvg
  }
  const instance: WasmResvg
  export default instance
}
declare module '#nuxt-og-image/bindings/chromium' {
  export const createBrowser: () => Promise<Browser | void>
}

declare module '#nuxt-og-image/bindings/css-inline' {
  import type _CssInline from 'css-inline'

  const cssInline: _CssInline
  export default cssInline
}

declare module '#nuxt-og-image/bindings/sharp' {
  import type _sharp from 'sharp'

  const sharp: _sharp
  export default sharp
}

declare module '#nuxt-og-image-virtual/component-names.mjs' {
  const componentNames: string[]
  export default componentNames
}

declare module '#nuxt-og-image-virtual/unocss-config.mjs' {
  const theme: Record<string, any>
  export default theme
}

declare module '#nuxt-og-image-cache' {
  import type { OgImageOptions } from '#nuxt-og-image/types'
  import type { Storage } from 'unstorage'

  export const htmlPayloadCache: Storage<{ expiresAt: number, value: OgImageOptions }>

  export const prerenderOptionsCache: Storage<OgImageOptions> | undefined

  export const fontCache: Storage<BufferSource> | undefined

  export const emojiCache: Storage<string>
}
