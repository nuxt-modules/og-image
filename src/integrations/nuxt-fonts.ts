import type { Nuxt } from '@nuxt/schema'
import { useLogger } from '@nuxt/kit'
import { $fetch } from 'ofetch'
import { createStorage, prefixStorage } from 'unstorage'

const logger = useLogger('nuxt-og-image:fonts')

export interface NuxtFontData {
  family: string
  weight: string | number
  style: string
  src: Array<{ url: string, format: string }>
  provider?: string
}

interface FontsModuleOptions {
  families?: Array<{
    name: string
    weights?: Array<string | number>
    styles?: string[]
    provider?: string
  }>
  providers?: Record<string, any>
  defaults?: {
    weights?: Array<string | number>
    styles?: string[]
    subsets?: string[]
  }
}

export class NuxtFontsIntegration {
  private fontMap = new Map<string, NuxtFontData>()
  private fontBufferCache = new Map<string, Buffer>()
  private storage: any
  private nuxtFontsOptions?: FontsModuleOptions

  constructor(private nuxt: Nuxt) {}

  async initialize() {
    // Get nuxt fonts module options
    this.nuxtFontsOptions = (this.nuxt.options as any).fonts as FontsModuleOptions || {}

    // Initialize storage
    const storage = createStorage()
    this.storage = prefixStorage(storage, 'og-image:fonts')

    // Hook into fonts module to capture providers
    this.nuxt.hook('fonts:providers', async (providers) => {
      logger.info('Detected Nuxt Fonts providers:', Object.keys(providers))
    })

    // Set up nitro plugin for runtime access
    this.setupNitroPlugin()

    // Process configured font families
    if (this.nuxtFontsOptions.families) {
      for (const family of this.nuxtFontsOptions.families) {
        const weights = family.weights || this.nuxtFontsOptions.defaults?.weights || [400]
        const styles = family.styles || this.nuxtFontsOptions.defaults?.styles || ['normal']

        for (const weight of weights) {
          for (const style of styles) {
            const key = this.getFontKey(family.name, weight, style)
            this.fontMap.set(key, {
              family: family.name,
              weight,
              style,
              src: [], // Will be populated by providers
              provider: family.provider,
            })
          }
        }
      }
    }
  }

  private getFontKey(family: string, weight: string | number, style: string): string {
    return `${family}-${weight}-${style}`.toLowerCase().replace(/\s+/g, '-')
  }

  private setupNitroPlugin() {
    const fontFamilies = this.getConfiguredFonts()

    // Add virtual module for runtime access
    this.nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.virtual ||= {}
      nitroConfig.virtual['#nuxt-og-image/fonts-integration'] = () => `
        export const hasNuxtFonts = true
        export const nuxtFontsConfig = ${JSON.stringify(this.nuxtFontsOptions)}
        export const nuxtFontFamilies = ${JSON.stringify(fontFamilies)}
      `

      // Add type declaration
      nitroConfig.typescript ||= {}
      nitroConfig.typescript.tsConfig ||= {}
      nitroConfig.typescript.tsConfig.compilerOptions ||= {}
      nitroConfig.typescript.tsConfig.compilerOptions.paths ||= {}
      nitroConfig.typescript.tsConfig.compilerOptions.paths['#nuxt-og-image/fonts-integration'] = ['./.nitro/types/nuxt-og-image-fonts']
    })
  }

  async resolveFont(fontConfig: any): Promise<any | null> {
    const key = this.getFontKey(
      fontConfig.name,
      fontConfig.weight || 400,
      fontConfig.style || 'normal',
    )

    // Check if font is configured in Nuxt Fonts
    const nuxtFont = this.fontMap.get(key)
    if (!nuxtFont) {
      logger.debug(`Font not found in Nuxt Fonts: ${key}`)
      return null
    }

    // Check cache first
    const cacheKey = `font:${key}`
    const cachedData = await this.storage.getItemRaw(cacheKey)
    if (cachedData) {
      return {
        ...fontConfig,
        data: Buffer.from(cachedData as ArrayBuffer),
        cacheKey: key,
      }
    }

    // Try to get font from Nuxt Fonts public assets
    try {
      // First check if font is available at /_fonts endpoint
      const fontFileName = `${key}.woff2`
      const fontUrl = `/_fonts/${fontFileName}`

      const response = await $fetch(fontUrl, {
        baseURL: this.nuxt.options.app.baseURL,
        responseType: 'arrayBuffer',
      }).catch(() => null)

      if (response) {
        const buffer = Buffer.from(response)
        await this.storage.setItemRaw(cacheKey, buffer)
        return {
          ...fontConfig,
          data: buffer,
          cacheKey: key,
        }
      }
    }
    catch {
      logger.debug(`Failed to fetch font from Nuxt Fonts assets: ${key}`)
    }

    return null
  }

  // Get configured fonts for auto-configuration
  getConfiguredFonts(): any[] {
    const fonts: any[] = []

    if (this.nuxtFontsOptions?.families) {
      for (const family of this.nuxtFontsOptions.families) {
        const weights = family.weights || this.nuxtFontsOptions.defaults?.weights || [400]
        const styles = family.styles || this.nuxtFontsOptions.defaults?.styles || ['normal']

        for (const weight of weights) {
          for (const style of styles) {
            fonts.push({
              name: family.name,
              weight,
              style: style as 'normal' | 'ital',
              cacheKey: this.getFontKey(family.name, weight, style),
            })
          }
        }
      }
    }

    return fonts
  }
}

let integration: NuxtFontsIntegration | null = null

export async function setupNuxtFontsIntegration(nuxt: Nuxt): Promise<NuxtFontsIntegration> {
  integration = new NuxtFontsIntegration(nuxt)
  await integration.initialize()
  return integration
}

export function getNuxtFontsIntegration(): NuxtFontsIntegration | null {
  return integration
}
