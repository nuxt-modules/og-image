declare module '#nuxt-og-image/bindings/satori' {
  import { satori as _satori } from 'satori'

  export const satori: typeof _satori = _satori
}
declare module '#nuxt-og-image/bindings/resvg' {
  export default import('resvg').resvg
}
declare module '#nuxt-og-image/bindings/chromium' {
  import { launch } from 'playwright-core'

  export const createBrowser: typeof launch = launch
}

declare module '#nuxt-og-image/components' {
  interface OgImageComponents {}
}

export {}
