import type { Component } from '@vue/runtime-core'

declare module '#nuxt-og-image/bindings/satori' {
  import { satori as _satori } from 'satori'

  export const satori: typeof _satori = _satori
}
declare module '#nuxt-og-image/bindings/resvg' {
  export default {
    initWasmPromise: Promise.resolve(),
    Resvg: import('resvg').Resvg,
  }
}
declare module '#nuxt-og-image/bindings/chromium' {
  import { launch } from 'playwright-core'

  export const createBrowser: typeof launch = launch
}

declare module '#nuxt-og-image/bindings/css-inline' {
  export default import('css-inline').default
}

declare module '#nuxt-og-image/components' {
  type OgImageComponents = Record<string, Component>
}

export {}
