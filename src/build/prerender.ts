import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { NitroConfig } from 'nitropack/config'
import type { ModuleOptions } from '../module'
import type { RendererType } from '../runtime/types'
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { useNuxt } from '@nuxt/kit'
import { join } from 'pathe'
import { applyNitroPresetCompatibility } from '../compatibility'
import { logger } from '../runtime/logger'

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

// prerender will always be called when using nuxi generate and sometimes be used when using nuxi build

export function setupPrerenderHandler(options: ModuleOptions, resolve: Resolver, getDetectedRenderers: () => Set<RendererType>, nuxt: Nuxt = useNuxt()) {
  nuxt.hooks.hook('nitro:init', async (nitro) => {
    nitro.hooks.hook('prerender:config', async (nitroConfig: NitroConfig) => {
      // bindings
      await applyNitroPresetCompatibility(nitroConfig, { compatibility: options.compatibility?.prerender, resolve, detectedRenderers: getDetectedRenderers() })
      // avoid wasm handling while prerendering
      nitroConfig.wasm = nitroConfig.wasm || {}
      nitroConfig.wasm.esmImport = false
      // Dynamic OG URLs are runtime-only. Prevent nitro's crawler from picking
      // them up via HTML meta extraction and writing them to disk as filenames,
      // which would hit the filesystem 255-byte limit for long signed URLs.
      // The resolver endpoint is excluded for the same reason and because each
      // resolution triggers a cross-page HTML fetch that may race with the
      // prerender graph.
      nitroConfig.prerender = nitroConfig.prerender || {}
      nitroConfig.prerender.ignore = nitroConfig.prerender.ignore || []
      if (Array.isArray(nitroConfig.prerender.ignore)) {
        nitroConfig.prerender.ignore.push('/_og/d/')
        nitroConfig.prerender.ignore.push('/_og/r/')
      }
    })

    // Track hash-mode OG URLs whose source page isn't in the prerender graph.
    // These 404 at context.ts because the page's defineOgImage() never ran so
    // the hash:<hash> cache entry was never written. Clear the error so nitro
    // doesn't add them to failedRoutes (which would fail the build).
    // Must use prerender:generate (fires before failedRoutes check), not
    // prerender:route (fires after — too late to prevent the build failure).
    const orphanedOgHashes: string[] = []
    nitro.hooks.hook('prerender:generate', (route) => {
      if (!route.error || route.error.statusCode !== 404)
        return
      if (!route.route.includes('/_og/s/o_'))
        return
      orphanedOgHashes.push(route.route)
      route.skip = true
      delete route.error
      // Clear contents so downstream hooks (e.g. html-validator) have nothing
      // to validate regardless of module registration order.
      route.contents = ''
    })

    nitro.hooks.hook('prerender:done', async () => {
      if (orphanedOgHashes.length > 0) {
        logger.warn(
          `Skipped ${orphanedOgHashes.length} orphaned OG image hash URL${orphanedOgHashes.length > 1 ? 's' : ''} during prerender. `
          + `These URLs were crawled from HTML but their source page was not prerendered, so the hash cache entry was never written. `
          + `If your pages are prerendered but OG images are generated at runtime, enable \`security.strict\` with a \`security.secret\` to switch to signed dynamic URLs.`,
        )
        for (const route of orphanedOgHashes)
          logger.info(`  ${route}`)
      }
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
        logger.debug(`Cleaned ${cleanedCount} orphaned OG image cache file${cleanedCount > 1 ? 's' : ''}.`)
    })
  })
}
