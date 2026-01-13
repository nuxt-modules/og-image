import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { NitroConfig } from 'nitropack/config'
import type { ModuleOptions } from '../module'
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { useNuxt } from '@nuxt/kit'
import { join } from 'pathe'
import { applyNitroPresetCompatibility } from '../compatibility'
import { logger } from '../runtime/logger'

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

// prerender will always be called when using nuxi generate and sometimes be used when using nuxi build

export function setupPrerenderHandler(options: ModuleOptions, resolve: Resolver, nuxt: Nuxt = useNuxt()) {
  nuxt.hooks.hook('nitro:init', async (nitro) => {
    nitro.hooks.hook('prerender:config', async (nitroConfig: NitroConfig) => {
      // bindings
      await applyNitroPresetCompatibility(nitroConfig, { compatibility: options.compatibility?.prerender, resolve })
      // avoid wasm handling while prerendering
      nitroConfig.wasm = nitroConfig.wasm || {}
      nitroConfig.wasm.esmImport = false
    })

    // Cleanup old build cache files after prerender
    nitro.hooks.hook('prerender:done', async () => {
      const buildCachePath = typeof options.buildCache === 'object' && options.buildCache.base
        ? options.buildCache.base
        : 'node_modules/.cache/nuxt-seo/og-image'
      const buildCacheDir = options.buildCache
        ? join(nuxt.options.rootDir, buildCachePath)
        : null

      if (!buildCacheDir || !existsSync(buildCacheDir))
        return

      const files = readdirSync(buildCacheDir)
      const now = Date.now()
      let cleanedCount = 0

      for (const file of files) {
        if (file.startsWith('.'))
          continue

        const filePath = join(buildCacheDir, file)
        const content = JSON.parse(readFileSync(filePath, 'utf-8'))
        const createdAt = content.createdAt || statSync(filePath).mtimeMs
        const expiresAt = content.expiresAt || 0

        // Delete if expired AND older than 1 week (grace period for social sites)
        const isExpired = expiresAt < now
        const isOld = now - createdAt > ONE_WEEK_MS
        if (isExpired && isOld) {
          rmSync(filePath)
          cleanedCount++
        }
      }

      if (cleanedCount > 0)
        logger.info(`Cleaned ${cleanedCount} orphaned OG image cache file${cleanedCount > 1 ? 's' : ''}.`)
    })
  })
}
