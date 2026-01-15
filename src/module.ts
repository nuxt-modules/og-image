import type { AddComponentOptions } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ResvgRenderOptions } from '@resvg/resvg-js'
import type { SatoriOptions } from 'satori'
import type { SharpOptions } from 'sharp'
import type {
  CompatibilityFlagEnvOverrides,
  CompatibilityFlags,
  OgImageComponent,
  OgImageOptions,
  OgImageRuntimeConfig,
  RuntimeCompatibilitySchema,
} from './runtime/types'
import * as fs from 'node:fs'
import { existsSync } from 'node:fs'
import { addBuildPlugin, addComponent, addComponentsDir, addImports, addPlugin, addServerHandler, addServerPlugin, addTemplate, addVitePlugin, createResolver, defineNuxtModule, hasNuxtModule } from '@nuxt/kit'
import { defu } from 'defu'
import { installNuxtSiteConfig } from 'nuxt-site-config/kit'
import { hash } from 'ohash'
import { isAbsolute, join, relative } from 'pathe'
import { readPackageJSON } from 'pkg-types'
import { isDevelopment } from 'std-env'
import { setupBuildHandler } from './build/build'
import { setupDevHandler } from './build/dev'
import { setupDevToolsUI } from './build/devtools'
import { setupGenerateHandler } from './build/generate'
import { setupPrerenderHandler } from './build/prerender'
import { TreeShakeComposablesPlugin } from './build/tree-shake-plugin'
import { AssetTransformPlugin } from './build/vite-asset-transform'
import {
  ensureDependencies,
  getPresetNitroPresetCompatibility,
  resolveNitroPreset,
} from './compatibility'
import { getNuxtModuleOptions, isNuxtGenerate } from './kit'
import { onInstall, onUpgrade } from './onboarding'
import { logger } from './runtime/logger'
import { registerTypeTemplates } from './templates'
import { checkLocalChrome, hasResolvableDependency, isUndefinedOrTruthy } from './util'
import {
  getMissingDependencies,
  getProviderDependencies,
} from './utils/dependencies'

export type {
  OgImageComponent,
  OgImageOptions,
  OgImageRuntimeConfig,
  RuntimeCompatibilitySchema,
} from './runtime/types'
export type { OgImageRenderEventContext, VNode } from './runtime/types'

const IS_MODULE_DEVELOPMENT = import.meta.filename.endsWith('.ts')

export interface ModuleOptions {
  /**
   * Whether the og:image images should be generated.
   *
   * @default true
   */
  enabled: boolean
  /**
   * Default data used within the payload to generate the OG Image.
   *
   * You can use this to change the default template, image sizing and more.
   *
   * @default { component: 'NuxtSeo', width: 1200, height: 630, cache: true, cacheTtl: 24 * 60 * 60 * 1000 }
   */
  defaults: OgImageOptions
  /**
   * Options to pass to satori.
   *
   * @see https://github.com/vercel/satori/blob/main/src/satori.ts#L18
   */
  satoriOptions?: Partial<SatoriOptions>
  /**
   * Options to pass to resvg.
   *
   * @see https://github.com/yisibl/resvg-js/blob/main/wasm/index.d.ts#L39
   */
  resvgOptions?: Partial<ResvgRenderOptions>
  /**
   * Options to pass to sharp.
   *
   * @see https://sharp.pixelplumbing.com/api-constructor
   */
  sharpOptions?: true | Partial<SharpOptions>
  /**
   * Enables debug logs and a debug endpoint.
   *
   * @false false
   */
  debug: boolean
  /**
   * Options to pass to the <OgImage> and <OgImageScreenshot> component.
   */
  componentOptions?: Pick<AddComponentOptions, 'global'>
  /**
   * Configure the runtime cache storage for generated OG images.
   * - `true` - Use Nitro's default cache storage (default)
   * - `false` - Disable caching
   * - `string` - Use a custom storage mount key (e.g., `'redis'`). You must mount the storage yourself via a Nitro plugin.
   * - `object` - Provide a driver config that the module will mount for you (build-time only)
   *
   * @default true
   * @see https://nitro.unjs.io/guide/storage#mountpoints
   * @example runtimeCacheStorage: 'redis' // Use your own mounted 'redis' storage
   * @example runtimeCacheStorage: { driver: 'redis', host: 'localhost', port: 6379 }
   */
  runtimeCacheStorage: boolean | string | (Record<string, any> & {
    driver: string
  })
  /**
   * Custom version string for cache key namespacing.
   *
   * By default, the module version is used which invalidates cache on upgrades.
   * Set a static value like `'v1'` to persist cache across module updates.
   * Set to `false` to disable versioning entirely.
   *
   * @default module version
   * @example cacheVersion: 'v1'
   * @example cacheVersion: false
   */
  cacheVersion?: string | false
  /**
   * Extra component directories that should be used to resolve components.
   *
   * @default ['OgImage', 'og-image', 'OgImageTemplate']
   */
  componentDirs: string[]
  /**
   * Manually modify the compatibility.
   */
  compatibility?: CompatibilityFlagEnvOverrides
  /**
   * Only allow the prerendering and dev runtimes to generate images.
   */
  zeroRuntime?: boolean
  /**
   * Enable persistent build cache for CI environments.
   * Caches rendered images to disk so they persist between CI runs.
   *
   * @default false
   * @example true
   * @example { base: '.cache/og-image' }
   */
  buildCache?: boolean | { base?: string }
  /**
   * Strategy for resolving emoji icons.
   *
   * - 'auto': Automatically choose based on available dependencies (default)
   * - 'local': Use local @iconify-json dependencies only
   * - 'fetch': Use Iconify API to fetch emojis
   *
   * @default 'auto'
   */
  emojiStrategy?: 'auto' | 'local' | 'fetch'
  /**
   * Include query parameters in cache keys.
   *
   * When enabled, requests like `/page?foo=bar` will have a separate cache from `/page`.
   * Enable this if your OG image content depends on query params.
   *
   * @default false
   */
  cacheQueryParams?: boolean
}

export interface ModuleHooks {
  'nuxt-og-image:components': (ctx: { components: OgImageComponent[] }) => Promise<void> | void
  'nuxt-og-image:runtime-config': (config: ModuleOptions) => Promise<void> | void
}

function isProviderEnabledForEnv(provider: keyof CompatibilityFlags, nuxt: Nuxt, config: ModuleOptions) {
  return (nuxt.options.dev && config.compatibility?.dev?.[provider] !== false) || (!nuxt.options.dev && (config.compatibility?.runtime?.[provider] !== false || config.compatibility?.prerender?.[provider] !== false))
}

const defaultComponentDirs = ['OgImage', 'OgImageCommunity', 'og-image', 'OgImageTemplate']

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-og-image',
    compatibility: {
      nuxt: '>=3.16.0',
    },
    configKey: 'ogImage',
  },
  moduleDependencies: {
    '@nuxt/content': {
      version: '>=3',
      optional: true,
    },
    '@nuxt/fonts': {
      version: '>=0.12.0',
    },
  },
  defaults() {
    return {
      enabled: true,
      defaults: {
        emojis: 'noto',
        renderer: 'satori',
        component: 'NuxtSeo',
        extension: 'png',
        width: 1200,
        height: 600,
        // default is to cache the image for 3 day (72 hours)
        cacheMaxAgeSeconds: 60 * 60 * 24 * 3,
      },
      componentDirs: defaultComponentDirs,
      runtimeCacheStorage: true,
      debug: isDevelopment,
    }
  },
  async onInstall(nuxt: Nuxt) {
    await onInstall(nuxt)
  },
  async onUpgrade(nuxt: Nuxt, options: ModuleOptions, previousVersion: string) {
    await onUpgrade(nuxt, options, previousVersion)
  },
  async setup(config, nuxt) {
    const resolver = createResolver(import.meta.url)
    const { resolve } = resolver
    const { version } = await readPackageJSON(resolve('../package.json'))
    const userAppPkgJson = await readPackageJSON(nuxt.options.rootDir)
      .catch(() => ({ dependencies: {}, devDependencies: {} }))
    logger.level = (config.debug || nuxt.options.debug) ? 4 : 3
    if (config.enabled === false) {
      logger.info('The module is disabled, skipping setup.')
      // need to mock the composables to allow module still to work when disabled
      ;['defineOgImage', 'defineOgImageComponent', 'defineOgImageScreenshot']
        .forEach((name) => {
          addImports({ name, from: resolve(`./runtime/app/composables/mock`) })
        })
      return
    }
    if (config.enabled && !nuxt.options.ssr) {
      logger.warn('Nuxt OG Image is enabled but SSR is disabled.\n\nYou should enable SSR (`ssr: true`) or disable the module (`ogImage: { enabled: false }`).')
      return
    }

    // validate provider dependencies
    const selectedRenderer = config.defaults.renderer || 'satori'
    const rendererMissing = await getMissingDependencies(selectedRenderer as 'satori' | 'takumi' | 'chromium', 'node')
    if (rendererMissing.length > 0) {
      const deps = getProviderDependencies(selectedRenderer as 'satori' | 'takumi' | 'chromium', 'node')
      logger.error(`Missing dependencies for ${selectedRenderer} renderer: ${rendererMissing.join(', ')}`)
      logger.info(`Install with: npm add ${deps.join(' ')}`)
      logger.info('Or run the module again to trigger the onInstall wizard.')
      return
    }

    // Warn about wildcard route rules that may break og-image routes
    const routeRules = nuxt.options.routeRules || {}
    const wildcardPatterns = ['/**', '/*', '*']
    for (const pattern of wildcardPatterns) {
      const rule = routeRules[pattern]
      if (rule && (rule.swr || rule.isr || rule.cache)) {
        logger.warn(`Wildcard route rule \`${pattern}\` with caching (swr/isr/cache) may break og-image routes.`)
        logger.info('See: https://nuxtseo.com/og-image/guides/route-rules#wildcard-route-rules-warning')
        break
      }
    }

    nuxt.options.alias['#og-image'] = resolve('./runtime')
    nuxt.options.alias['#og-image-cache'] = resolve('./runtime/server/og-image/cache/lru')

    // Resolve preset early to check compatibility settings
    const preset = resolveNitroPreset(nuxt.options.nitro)
    const targetCompatibility = getPresetNitroPresetCompatibility(preset)

    // Determine emoji strategy based on configuration and dependencies
    const emojiPkg = `@iconify-json/${config.defaults.emojis}`
    let hasLocalIconify = await hasResolvableDependency(emojiPkg)
    let finalEmojiStrategy = config.emojiStrategy || 'auto'

    // Prompt to install emoji package in dev mode (non-CI, non-prepare)
    if (!hasLocalIconify && !nuxt.options._prepare && nuxt.options.dev) {
      const shouldInstall = await logger.prompt(`Install ${emojiPkg} for local emoji support?`, {
        type: 'confirm',
        initial: true,
      })
      if (shouldInstall) {
        await ensureDependencies([emojiPkg], nuxt)
          .then(() => {
            hasLocalIconify = true
            logger.success(`Installed ${emojiPkg}`)
          })
          .catch(() => logger.warn(`Failed to install ${emojiPkg}, using API fallback`))
      }
    }

    // Handle 'auto' strategy
    if (finalEmojiStrategy === 'auto') {
      finalEmojiStrategy = hasLocalIconify ? 'local' : 'fetch'
    }

    // Validate strategy against available dependencies
    if (finalEmojiStrategy === 'local' && !hasLocalIconify) {
      logger.warn(`emojiStrategy is set to 'local' but ${emojiPkg} is not installed. Falling back to 'fetch'.`)
      finalEmojiStrategy = 'fetch'
    }

    // Use preset compatibility to determine runtime emoji strategy
    // Edge presets use 'fetch' to avoid bundling 24MB of emoji icons
    // Build-time transforms (vite plugin) still use local icons for prerendering
    const runtimeEmojiStrategy = targetCompatibility.emoji === 'fetch' ? 'fetch' : finalEmojiStrategy

    // Set emoji implementation based on runtime strategy
    if (runtimeEmojiStrategy === 'local') {
      logger.info(`Using local dependency \`${emojiPkg}\` for emoji rendering.`)
      nuxt.options.alias['#og-image/emoji-transform'] = resolve('./runtime/server/og-image/satori/transforms/emojis/local')
      // add nitro virtual import for the iconify import
      nuxt.options.nitro.virtual = nuxt.options.nitro.virtual || {}
      nuxt.options.nitro.virtual['#og-image-virtual/iconify-json-icons.mjs'] = () => {
        return `export { icons, width, height } from '${emojiPkg}/icons.json'`
      }
    }
    else {
      if (targetCompatibility.emoji === 'fetch' && finalEmojiStrategy === 'local') {
        logger.info(`Using iconify API for runtime emojis on ${preset} (local icons used at build time).`)
      }
      else {
        logger.info(`Using iconify API for emojis${hasLocalIconify ? ' (emojiStrategy: fetch)' : `, install ${emojiPkg} for local support`}.`)
      }
      nuxt.options.alias['#og-image/emoji-transform'] = resolve('./runtime/server/og-image/satori/transforms/emojis/fetch')
    }

    // Add build-time asset transform plugin for OgImage components
    // Handles: emoji → SVG (when local), Icon/UIcon → inline SVG, local images → data URI
    addVitePlugin(AssetTransformPlugin.vite({
      emojiSet: finalEmojiStrategy === 'local' ? (config.defaults.emojis || 'noto') : undefined,
      componentDirs: config.componentDirs,
      rootDir: nuxt.options.rootDir,
      srcDir: nuxt.options.srcDir,
      publicDir: resolve(nuxt.options.srcDir, nuxt.options.dir.public || 'public'),
    }))

    if (config.zeroRuntime) {
      config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
        runtime: {
          chromium: false, // should already be false
          satori: false,
        },
      })

      if (!nuxt.options.dev) {
        addBuildPlugin(TreeShakeComposablesPlugin, { server: true, client: true, build: true })
        nuxt.options.alias['#og-image-cache'] = resolve('./runtime/server/og-image/cache/mock')
      }
    }
    const basePath = config.zeroRuntime ? './runtime/server/routes/__zero-runtime' : './runtime/server/routes'
    let publicDirAbs = nuxt.options.dir.public
    if (!isAbsolute(publicDirAbs)) {
      publicDirAbs = (publicDirAbs in nuxt.options.alias ? nuxt.options.alias[publicDirAbs] : resolve(nuxt.options.rootDir, publicDirAbs)) || ''
    }
    if (isProviderEnabledForEnv('satori', nuxt, config)) {
      let attemptSharpUsage = false
      if (isProviderEnabledForEnv('sharp', nuxt, config)) {
        // avoid any sharp logic if user explicitly opts-out
        const userConfiguredExtension = config.defaults.extension
        const hasConfiguredJpegs = userConfiguredExtension && ['jpeg', 'jpg'].includes(userConfiguredExtension)
        const allDeps = {
          ...(userAppPkgJson.dependencies || {}),
          ...(userAppPkgJson.devDependencies || {}),
        }
        const hasExplicitSharpDependency = !!config.sharpOptions || 'sharp' in allDeps || (hasConfiguredJpegs && config.defaults.renderer !== 'chromium')
        if (hasExplicitSharpDependency) {
          if (!targetCompatibility.sharp) {
            logger.warn(`Rendering JPEGs requires sharp which does not work with ${preset}. Images will be rendered as PNG at runtime.`)
            config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
              runtime: { sharp: false },
            })
          }
          else {
            // if we can import it then we'll use it
            await import('sharp')
              .catch(() => {})
              .then(() => {
                attemptSharpUsage = true
              })
          }
        }
        else if (hasConfiguredJpegs && config.defaults.renderer !== 'chromium') {
          // sharp is supported but not installed
          logger.warn('You have enabled `JPEG` images. These require the `sharp` dependency which is missing, installing it for you.')
          await ensureDependencies(['sharp'])
          logger.warn('Support for `sharp` is limited so check the compatibility guide.')
          attemptSharpUsage = true
        }
      }
      if (!attemptSharpUsage) {
        // disable sharp
        config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
          runtime: { sharp: false },
          dev: { sharp: false },
          prerender: { sharp: false },
        })
      }
      if (isProviderEnabledForEnv('resvg', nuxt, config)) {
        // let's check we can access resvg
        await import('@resvg/resvg-js')
          .catch(() => {
            logger.warn('ReSVG is missing dependencies for environment. Falling back to WASM version, this may slow down PNG rendering.')
            config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
              dev: { resvg: 'wasm-fs' },
              prerender: { resvg: 'wasm-fs' },
            })
            // swap out runtime node for wasm if we have a broken dependency
            if (targetCompatibility.resvg === 'node') {
              config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
                runtime: { resvg: 'wasm' },
              })
            }
          })
      }
    }

    if (isProviderEnabledForEnv('chromium', nuxt, config)) {
      // in dev and prerender we rely on local chrome or playwright dependency
      // for runtime we need playwright dependency
      const hasChromeLocally = checkLocalChrome()
      const hasPlaywrightDependency = await hasResolvableDependency('playwright')
      const chromeCompatibilityFlags = {
        prerender: config.compatibility?.prerender?.chromium,
        dev: config.compatibility?.dev?.chromium,
        runtime: config.compatibility?.runtime?.chromium,
      }
      const chromiumBinding: Record<string, RuntimeCompatibilitySchema['chromium'] | null> = {
        dev: null,
        prerender: null,
        runtime: null,
      }
      if (nuxt.options.dev) {
        if (isUndefinedOrTruthy(chromeCompatibilityFlags.dev))
          chromiumBinding.dev = hasChromeLocally ? 'chrome-launcher' : hasPlaywrightDependency ? 'playwright' : 'on-demand'
      }
      else {
        if (isUndefinedOrTruthy(chromeCompatibilityFlags.prerender))
          chromiumBinding.prerender = hasChromeLocally ? 'chrome-launcher' : hasPlaywrightDependency ? 'playwright' : 'on-demand'
        if (isUndefinedOrTruthy(chromeCompatibilityFlags.runtime))
          chromiumBinding.runtime = hasPlaywrightDependency ? 'playwright' : null
      }
      config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
        runtime: { chromium: chromiumBinding.runtime },
        dev: { chromium: chromiumBinding.dev },
        prerender: { chromium: chromiumBinding.prerender },
      })
    }

    await installNuxtSiteConfig()

    nuxt.options.experimental.componentIslands ||= true

    if (config.debug || nuxt.options.dev) {
      addServerHandler({
        lazy: true,
        route: '/_og/debug.json',
        handler: resolve('./runtime/server/routes/debug.json'),
      })
    }
    addServerHandler({
      lazy: true,
      route: '/_og/d/**',
      handler: resolve(`${basePath}/image`),
    })
    // prerender only
    addServerHandler({
      lazy: true,
      route: '/_og/s/**',
      handler: resolve(`${basePath}/image`),
    })

    if (!nuxt.options.dev) {
      nuxt.options.optimization.treeShake.composables.client['nuxt-og-image'] = []
    }
    ;[
      'defineOgImage',
      'defineOgImageComponent',
      { name: 'defineOgImageScreenshot', enabled: isProviderEnabledForEnv('chromium', nuxt, config) },
    ]
      .forEach((name) => {
        if (typeof name === 'object') {
          if (!name.enabled) {
            addImports({ name: name.name, from: resolve(`./runtime/app/composables/mock`) })
            return
          }
          name = name.name
        }
        addImports({
          name,
          from: resolve(`./runtime/app/composables/${name}`),
        })
        if (!nuxt.options.dev) {
          nuxt.options.optimization.treeShake.composables.client = nuxt.options.optimization.treeShake.composables.client || {}
          nuxt.options.optimization.treeShake.composables.client['nuxt-og-image'] = nuxt.options.optimization.treeShake.composables.client['nuxt-og-image'] || []
          nuxt.options.optimization.treeShake.composables.client['nuxt-og-image'].push(name)
        }
      })

    // community templates only in dev - must be ejected for production
    if (nuxt.options.dev) {
      addComponentsDir({
        path: resolve('./runtime/app/components/Templates/Community'),
        island: true,
        watch: IS_MODULE_DEVELOPMENT,
      })
    }

    ;[
      // new
      'OgImage',
      'OgImageScreenshot',
    ]
      .forEach((name) => {
        addComponent({
          name,
          filePath: resolve(`./runtime/app/components/OgImage/${name}`),
          ...config.componentOptions,
        })
      })

    const basePluginPath = `./runtime/app/plugins${config.zeroRuntime ? '/__zero-runtime' : ''}`
    // allows us to add og images using route rules without calling defineOgImage
    addPlugin({ mode: 'server', src: resolve(`${basePluginPath}/route-rule-og-image.server`) })
    addPlugin({ mode: 'server', src: resolve(`${basePluginPath}/og-image-canonical-urls.server`) })

    for (const componentDir of config.componentDirs) {
      const path = resolve(nuxt.options.srcDir, 'components', componentDir)
      if (existsSync(path)) {
        addComponentsDir({
          path,
          island: true,
          watch: IS_MODULE_DEVELOPMENT,
          // OgImageCommunity components should be named OgImage* not OgImageCommunity*
          prefix: componentDir === 'OgImageCommunity' ? 'OgImage' : undefined,
        })
      }
      else if (!defaultComponentDirs.includes(componentDir)) {
        logger.warn(`The configured component directory \`./${relative(nuxt.options.rootDir, path)}\` does not exist. Skipping.`)
      }
    }

    // we're going to expose the og image components to the ssr build so we can fix prop usage
    const ogImageComponentCtx: { components: OgImageComponent[] } = { components: [] }
    nuxt.hook('components:extend', (components) => {
      ogImageComponentCtx.components = []
      const validComponents: typeof components = []
      // check if the component folder starts with OgImage or OgImageTemplate and set to an island component
      components.forEach((component) => {
        let valid = false
        config.componentDirs.forEach((dir) => {
          if (component.pascalName.startsWith(dir) || component.kebabName.startsWith(dir)
            // support non-prefixed components
            || component.shortPath.includes(`/${dir}/`)) {
            valid = true
          }
        })
        if (component.filePath.includes(resolve('./runtime/app/components/Templates')))
          valid = true

        if (valid && fs.existsSync(component.filePath)) {
          // get hash of the file
          component.island = true
          component.mode = 'server'
          validComponents.push(component)
          let category: OgImageComponent['category'] = 'app'
          if (component.filePath.includes(resolve('./runtime/app/components/Templates/Community')))
            category = 'community'
          const componentFile = fs.readFileSync(component.filePath, 'utf-8')
          // see if we can extract credits from the component file, just find the line that starts with * @credits and return the rest of the line
          const credits = componentFile.split('\n').find(line => line.startsWith(' * @credits'))?.replace('* @credits', '').trim()
          ogImageComponentCtx.components.push({
            // purge cache when component changes
            hash: hash(componentFile).replaceAll('_', '-'),
            pascalName: component.pascalName,
            kebabName: component.kebabName,
            path: component.filePath,
            category,
            credits,
          })
        }
      })
      // in production, add community template metadata for validation (not registered as components)
      if (!nuxt.options.dev) {
        const communityDir = resolve('./runtime/app/components/Templates/Community')
        if (fs.existsSync(communityDir)) {
          fs.readdirSync(communityDir)
            .filter(f => f.endsWith('.vue'))
            .forEach((file) => {
              const name = file.replace('.vue', '')
              const filePath = resolve(communityDir, file)
              // skip if already added (user ejected with same name)
              if (ogImageComponentCtx.components.some(c => c.pascalName === name))
                return
              ogImageComponentCtx.components.push({
                hash: '',
                pascalName: name,
                kebabName: name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
                path: filePath,
                category: 'community',
              })
            })
        }
      }
      // TODO add hook and types
      // @ts-expect-error untyped
      nuxt.hooks.hook('nuxt-og-image:components', ogImageComponentCtx)
    })
    addTemplate({
      filename: 'nuxt-og-image/components.mjs',
      getContents() {
        return `export const componentNames = ${JSON.stringify(ogImageComponentCtx.components)}`
      },
      options: { mode: 'server' },
    })

    nuxt.options.nitro.virtual = nuxt.options.nitro.virtual || {}
    nuxt.options.nitro.virtual['#og-image-virtual/component-names.mjs'] = () => {
      return `export const componentNames = ${JSON.stringify(ogImageComponentCtx.components)}`
    }
    nuxt.options.nitro.virtual['#og-image-virtual/public-assets.mjs'] = async () => {
      // load from src/runtime/server/og-image/bindings/font-assets conditionally
      return `export { resolve } from '${resolver.resolve('./runtime/server/og-image/bindings/font-assets/dev-prerender')}'`
    }
    nuxt.options.nitro.virtual['#og-image/fonts'] = async () => {
      // find nuxt-fonts-global.css template
      const templates = nuxt.options.build.templates
      const nuxtFontsTemplate = templates.find(t => t.filename?.endsWith('nuxt-fonts-global.css'))
      if (!nuxtFontsTemplate?.getContents) {
        return `export default []`
      }
      const contents = await nuxtFontsTemplate.getContents({} as any)

      // parse @font-face blocks
      const fontFaceRegex = /@font-face\s*\{([^}]+)\}/g
      const fonts: Array<{ family: string, src: string, weight: number, style: string }> = []

      for (const match of contents.matchAll(fontFaceRegex)) {
        const block = match[1]
        if (!block)
          continue
        const family = block.match(/font-family:\s*['"]?([^'";]+)['"]?/)?.[1]?.trim()
        const src = block.match(/url\(["']?([^)"']+)["']?\)/)?.[1]
        const weight = Number.parseInt(block.match(/font-weight:\s*(\d+)/)?.[1] || '400')
        const style = block.match(/font-style:\s*(\w+)/)?.[1] || 'normal'

        if (family && src) {
          fonts.push({ family, src, weight, style })
        }
      }
      // warn at build time if satori will have issues (no non-woff2 fonts)
      const familiesWithNonWoff2 = new Set(fonts.filter(f => !f.src.endsWith('.woff2')).map(f => f.family))
      const warnedFamilies = new Set<string>()
      for (const f of fonts) {
        if (f.src.endsWith('.woff2') && !familiesWithNonWoff2.has(f.family) && !warnedFamilies.has(f.family)) {
          warnedFamilies.add(f.family)
          logger.warn(`WOFF2-only font detected (${f.family}). Satori renderer does not support WOFF2 - use Takumi renderer or provide WOFF/TTF alternatives.`)
        }
      }
      logger.debug(`Extracted fonts from @nuxt/fonts: ${JSON.stringify(fonts)}`)
      return `export default ${JSON.stringify(fonts)}`
    }

    // support simple theme extends
    let unoCssConfig: any = {}
    // @ts-expect-error module optional
    nuxt.hook('tailwindcss:config', (tailwindConfig) => {
      unoCssConfig = defu(tailwindConfig.theme?.extend, { ...tailwindConfig.theme, extend: undefined })
    })
    nuxt.hook('unocss:config', (_unoCssConfig) => {
      unoCssConfig = { ..._unoCssConfig.theme }
    })
    nuxt.options.nitro.virtual['#og-image-virtual/unocss-config.mjs'] = () => {
      return `export const theme = ${JSON.stringify(unoCssConfig)}`
    }
    nuxt.options.nitro.virtual['#og-image-virtual/build-dir.mjs'] = () => {
      return `export const buildDir = ${JSON.stringify(nuxt.options.buildDir)}`
    }

    // Hook into @nuxt/fonts to persist font URL mapping for prerender
    // fonts:public-asset-context fires at modules:done, giving us a reference to the context
    // We then read from renderedFontURLs in vite:compiled when it's populated
    let fontContext: { renderedFontURLs: Map<string, string> } | null = null
    nuxt.hook('fonts:public-asset-context' as any, (ctx: { renderedFontURLs: Map<string, string> }) => {
      fontContext = ctx
    })
    nuxt.hook('vite:compiled', () => {
      if (fontContext?.renderedFontURLs.size) {
        const cacheDir = join(nuxt.options.buildDir, 'cache', 'og-image')
        fs.mkdirSync(cacheDir, { recursive: true })
        const mapping = Object.fromEntries(fontContext.renderedFontURLs)
        fs.writeFileSync(join(cacheDir, 'font-urls.json'), JSON.stringify(mapping))
        logger.debug(`Persisted ${fontContext.renderedFontURLs.size} font URLs for prerender`)
      }
    })

    registerTypeTemplates({
      nuxt,
      config,
      componentCtx: ogImageComponentCtx,
    })

    const cacheEnabled = typeof config.runtimeCacheStorage !== 'undefined' && config.runtimeCacheStorage !== false
    const cacheVersion = config.cacheVersion === false ? '' : (config.cacheVersion ?? version)
    const versionSuffix = cacheVersion ? `/${cacheVersion}` : ''
    let baseCacheKey: string | false
    if (config.runtimeCacheStorage === true) {
      // default: use nitro's built-in cache storage
      baseCacheKey = `/cache/nuxt-og-image${versionSuffix}`
    }
    else if (typeof config.runtimeCacheStorage === 'string') {
      // string: user provides their own storage mount key
      baseCacheKey = `/${config.runtimeCacheStorage}/nuxt-og-image${versionSuffix}`
    }
    else if (typeof config.runtimeCacheStorage === 'object') {
      // object: module mounts the storage
      baseCacheKey = `/nuxt-og-image${versionSuffix}`
      if (!nuxt.options.dev) {
        nuxt.options.nitro.storage = nuxt.options.nitro.storage || {}
        nuxt.options.nitro.storage['nuxt-og-image'] = config.runtimeCacheStorage
      }
    }
    else {
      baseCacheKey = false
    }
    if (!cacheEnabled)
      baseCacheKey = false

    // Build cache for CI persistence (absolute path)
    const buildCachePath = typeof config.buildCache === 'object' && config.buildCache.base
      ? config.buildCache.base
      : 'node_modules/.cache/nuxt-seo/og-image'
    const buildCacheDir = config.buildCache
      ? resolve(nuxt.options.rootDir, buildCachePath)
      : undefined
    nuxt.hooks.hook('modules:done', async () => {
      // allow other modules to modify runtime data
      if (!isNuxtGenerate() && nuxt.options.build) {
        nuxt.options.nitro = nuxt.options.nitro || {}
        nuxt.options.nitro.prerender = nuxt.options.nitro.prerender || {}
        nuxt.options.nitro.prerender.routes = nuxt.options.nitro.prerender.routes || []
      }

      // set theme color for the NuxtSeo component
      type ColorMode = 'light' | 'dark' | 'system'
      const hasColorModeModule = hasNuxtModule('@nuxtjs/color-mode')
      const colorModeOptions: { fallback?: ColorMode, preference?: ColorMode } = hasColorModeModule
        ? (await getNuxtModuleOptions('@nuxtjs/color-mode') as { fallback?: ColorMode, preference?: ColorMode })
        : {}
      let colorPreference = colorModeOptions.preference
      if (!colorPreference || colorPreference === 'system')
        colorPreference = colorModeOptions.fallback
      if (!colorPreference || colorPreference === 'system')
        colorPreference = 'light'
      const runtimeConfig = <OgImageRuntimeConfig>{
        version,
        // binding options
        satoriOptions: config.satoriOptions || {},
        resvgOptions: config.resvgOptions || {},
        sharpOptions: config.sharpOptions === true ? {} : (config.sharpOptions || {}),
        publicStoragePath: `root${publicDirAbs.replace(nuxt.options.rootDir, '').replaceAll('/', ':')}`,

        defaults: config.defaults,
        debug: config.debug,
        // avoid adding credentials
        baseCacheKey,
        buildCacheDir,
        hasNuxtIcon: hasNuxtModule('nuxt-icon') || hasNuxtModule('@nuxt/icon'),
        colorPreference,

        // @ts-expect-error runtime type
        isNuxtContentDocumentDriven: !!nuxt.options.content?.documentDriven,
        cacheQueryParams: config.cacheQueryParams ?? false,
      }
      if (nuxt.options.dev) {
        runtimeConfig.componentDirs = config.componentDirs
      }
      // @ts-expect-error untyped
      nuxt.hooks.callHook('nuxt-og-image:runtime-config', runtimeConfig)
      // @ts-expect-error untyped
      nuxt.options.runtimeConfig['nuxt-og-image'] = runtimeConfig
    })

    // Setup playground. Only available in development
    if (nuxt.options.dev) {
      setupDevHandler(config, resolver)
      setupDevToolsUI(config, resolve)
    }
    else if (isNuxtGenerate()) {
      setupGenerateHandler(config, resolver)
    }
    else if (nuxt.options.build) {
      await setupBuildHandler(config, resolver)
    }
    // no way to know if we'll prerender any routes
    if (nuxt.options.build)
      addServerPlugin(resolve('./runtime/server/plugins/prerender'))
    // always call this as we may have routes only discovered at build time
    setupPrerenderHandler(config, resolver)
  },
})
