declare module '#nuxt-og-image/fonts' {
  export const hasNuxtFonts: boolean
  export const resolvedFonts: Array<{
    family: string
    weight: number
    style: 'normal' | 'italic'
    src: string // original provider URL for fallback
    localPath: string // /_fonts/{filename} - for @nuxt/fonts cache lookup
  }>
}
