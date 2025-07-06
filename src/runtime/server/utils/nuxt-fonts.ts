import { useStorage } from 'nitropack/runtime'
import { $fetch } from 'ofetch'
import { prefixStorage } from 'unstorage'

const storage = prefixStorage(useStorage(), 'og-image:fonts')

export async function tryResolveNuxtFont(font: any): Promise<any | null> {
  try {
    const { nuxtFontFamilies } = await import('#nuxt-og-image/fonts-integration')

    // Check if this font is configured in Nuxt Fonts
    const isConfigured = nuxtFontFamilies.some((f: any) =>
      f.name === font.name
      && f.weight === (font.weight || 400)
      && f.style === (font.style || 'normal'),
    )

    if (!isConfigured) {
      return null
    }

    // Generate font key
    const fontKey = `${font.name}-${font.weight || 400}-${font.style || 'normal'}`.toLowerCase().replace(/\s+/g, '-')

    // Check cache first
    const cacheKey = `font:${fontKey}`
    const cachedData = await storage.getItemRaw(cacheKey)
    if (cachedData) {
      return {
        ...font,
        data: Buffer.from(cachedData as ArrayBuffer),
        cacheKey: fontKey,
      }
    }

    // Try to get font from Nuxt Fonts public assets
    // Try common font formats in order of preference
    const formats = ['.woff2', '.woff', '.ttf', '.otf']

    for (const format of formats) {
      const fontFileName = `${fontKey}${format}`
      const fontUrl = `/_fonts/${fontFileName}`

      try {
        const response = await $fetch(fontUrl, {
          responseType: 'arrayBuffer',
        })

        if (response) {
          const buffer = Buffer.from(response)
          await storage.setItemRaw(cacheKey, buffer)
          return {
            ...font,
            data: buffer,
            cacheKey: fontKey,
          }
        }
      }
      catch {
        // Try next format
      }
    }
  }
  catch {
    // Silently ignore errors in Nuxt Fonts integration
  }

  return null
}
