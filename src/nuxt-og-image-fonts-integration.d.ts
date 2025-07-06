declare module '#nuxt-og-image/fonts-integration' {
  export const hasNuxtFonts: boolean
  export const nuxtFontsConfig: any
  export const nuxtFontFamilies: Array<{
    name: string
    weight?: string | number
    style?: string
  }>
}