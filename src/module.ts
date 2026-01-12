import type { AddComponentOptions } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ResvgRenderOptions } from '@resvg/resvg-js'
import type { SatoriOptions } from 'satori'
import type { SharpOptions } from 'sharp'
import type {
  CompatibilityFlagEnvOverrides,
  CompatibilityFlags,
  FontConfig,
  InputFontConfig,
  OgImageComponent,
  OgImageOptions,
  OgImageRuntimeConfig,
  ResolvedFontConfig,
  RuntimeCompatibilitySchema,
} from './runtime/types'
import * as fs from 'node:fs'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { addBuildPlugin, addComponent, addComponentsDir, addImports, addPlugin, addServerHandler, addServerPlugin, addTemplate, createResolver, defineNuxtModule, hasNuxtModule } from '@nuxt/kit'
import { defu } from 'defu'
import { installNuxtSiteConfig } from 'nuxt-site-config/kit'
import { hash } from 'ohash'
import { basename, isAbsolute, relative } from 'pathe'
import { readPackageJSON } from 'pkg-types'
import { isDevelopment } from 'std-env'
import { withoutLeadingSlash } from 'ufo'
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import { setupBuildHandler } from './build/build'
import { setupDevHandler } from './build/dev'
import { setupDevToolsUI } from './build/devtools'
import { setupGenerateHandler } from './build/generate'
import { setupPrerenderHandler } from './build/prerender'
import { TreeShakeComposablesPlugin } from './build/tree-shake-plugin'
import {
  ensureDependencies,
  getPresetNitroPresetCompatibility,
  resolveNitroPreset,
} from './compatibility'
import { getNuxtModuleOptions, isNuxtGenerate } from './kit'
import { onInstall, onUpgrade } from './onboarding'
import { normaliseFontInput } from './pure'
import { logger } from './runtime/logger'
import { registerTypeTemplates } from './templates'
import { checkLocalChrome, downloadFont, hasResolvableDependency, isUndefinedOrTruthy } from './util'
import {
  getMissingDependencies,
  getProviderDependencies,
} from './utils/dependencies'

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
   * Fonts to use when rendering the og:image.
   *
   * @example ['Roboto:400', 'Roboto:700', { path: 'path/to/font.ttf', weight: 400, name: 'MyFont' }]
   */
  fonts: InputFontConfig[]
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
   * Modify the cache behavior.
   *
   * Passing a boolean will enable or disable the runtime cache with the default options.
   *
   * Providing a record will allow you to configure the runtime cache fully.
   *
   * @default true
   * @see https://nitro.unjs.io/guide/storage#mountpoints
   * @example { driver: 'redis', host: 'localhost', port: 6379, password: 'password' }
   */
  runtimeCacheStorage: boolean | (Record<string, any> & {
    driver: string
  })
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
   * Use an alternative host for downloading Google Fonts.
   *
   * Provide a custom mirror host (e.g., your own proxy server).
   * Note: The mirror must serve TTF fonts for Satori compatibility.
   * For China users, consider using local font files via the `path` option instead.
   */
  googleFontMirror?: string
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
}

export interface ModuleHooks {
  'nuxt-og-image:components': (ctx: { components: OgImageComponent[] }) => Promise<void> | void
  'nuxt-og-image:runtime-config': (config: ModuleOptions) => Promise<void> | void
}

function isProviderEnabledForEnv(provider: keyof CompatibilityFlags, nuxt: Nuxt, config: ModuleOptions) {
  return (nuxt.options.dev && config.compatibility?.dev?.[provider] !== false) || (!nuxt.options.dev && (config.compatibility?.runtime?.[provider] !== false || config.compatibility?.prerender?.[provider] !== false))
}

const defaultComponentDirs = ['OgImage', 'og-image', 'OgImageTemplate']

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
      fonts: [],
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
      logger.debug('The module is disabled, skipping setup.')
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

    nuxt.options.alias['#og-image'] = resolve('./runtime')
    nuxt.options.alias['#og-image-cache'] = resolve('./runtime/server/og-image/cache/lru')

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

    // Set emoji implementation based on final strategy
    if (finalEmojiStrategy === 'local') {
      logger.debug(`Using local dependency \`${emojiPkg}\` for emoji rendering.`)
      nuxt.options.alias['#og-image/emoji-transform'] = resolve('./runtime/server/og-image/satori/transforms/emojis/local')
      // add nitro virtual import for the iconify import
      nuxt.options.nitro.virtual = nuxt.options.nitro.virtual || {}
      nuxt.options.nitro.virtual['#og-image-virtual/iconify-json-icons.mjs'] = () => {
        return `export { icons } from '${emojiPkg}/icons.json'`
      }
    }
    else {
      logger.info(`Using iconify API for emojis${hasLocalIconify ? ' (emojiStrategy: fetch)' : `, install ${emojiPkg} for local support`}.`)
      nuxt.options.alias['#og-image/emoji-transform'] = resolve('./runtime/server/og-image/satori/transforms/emojis/fetch')
    }

    const preset = resolveNitroPreset(nuxt.options.nitro)
    const targetCompatibility = getPresetNitroPresetCompatibility(preset)

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
      // default font is inter
      if (!config.fonts.length) {
        config.fonts = [
          {
            name: 'Inter',
            weight: 400,
            path: resolve('./runtime/assets/Inter-normal-400.ttf.base64'),
            absolutePath: true,
          },
          {
            name: 'Inter',
            weight: 700,
            path: resolve('./runtime/assets/Inter-normal-700.ttf.base64'),
            absolutePath: true,
          },
        ]
      }

      // persist between versions
      const serverFontsDir = resolve(nuxt.options.buildDir, 'cache', `nuxt-og-image`, '_fonts')
      const fontStorage = createStorage({
        driver: fsDriver({
          base: serverFontsDir,
        }),
      })
      config.fonts = (await Promise.all(normaliseFontInput(config.fonts)
        .map(async (f) => {
          const fontKey = `${f.name}:${f.style}:${f.weight}`
          const fontFileBase = fontKey.replaceAll(':', '-')
          if (!f.key && !f.path) {
            if (preset === 'stackblitz') {
              logger.warn(`The ${fontKey} font was skipped because remote fonts are not available in StackBlitz, please use a local font.`)
              return false
            }
            const result = await downloadFont(f, fontStorage, config.googleFontMirror)
            if (result.success) {
              // move file to serverFontsDir
              f.key = `nuxt-og-image:fonts:${fontFileBase}.ttf.base64`
            }
            else {
              const mirrorMsg = config.googleFontMirror
                ? `using mirror host \`${result.host}\``
                : 'Consider using local font files via the `path` option if you are in China or behind a firewall.'
              logger.warn(`Failed to download font ${fontKey} ${mirrorMsg}`)
              if (result.error)
                logger.warn(`  Error: ${result.error.message || result.error}`)
              return false
            }
          }
          else if (f.path) {
            // validate the extension, can only be woff, ttf or otf
            const extension = basename(f.path.replace('.base64', '')).split('.').pop()!
            if (!['woff', 'ttf', 'otf'].includes(extension)) {
              logger.warn(`The ${fontKey} font was skipped because the file extension ${extension} is not supported. Only woff, ttf and otf are supported.`)
              return false
            }
            // resolve relative paths from public dir
            // move to assets folder as base64 and set key
            if (!f.absolutePath)
              f.path = resolve(publicDirAbs, withoutLeadingSlash(f.path))
            if (!existsSync(f.path)) {
              logger.warn(`The ${fontKey} font was skipped because the file does not exist at path ${f.path}.`)
              return false
            }
            const fontData = await readFile(f.path, f.path.endsWith('.base64') ? 'utf-8' : 'base64')
            f.key = `nuxt-og-image:fonts:${fontFileBase}.${extension}.base64`
            await fontStorage.setItem(`${fontFileBase}.${extension}.base64`, fontData)
            delete f.path
            delete f.absolutePath
          }
          return f
        }))).filter(Boolean) as InputFontConfig[]

      const fontKeys = (config.fonts as ResolvedFontConfig[]).map(f => f.key?.split(':').pop())
      const fontStorageKeys = await fontStorage.getKeys()
      await Promise.all(fontStorageKeys
        .filter(key => !fontKeys.includes(key))
        .map(async (key) => {
          logger.info(`Nuxt OG Image removing outdated cached font file \`${key}\``)
          await fontStorage.removeItem(key)
        }))
      if (!config.zeroRuntime) {
        // bundle fonts within nitro runtime
        nuxt.options.nitro.serverAssets = nuxt.options.nitro.serverAssets || []
        nuxt.options.nitro.serverAssets!.push({ baseName: 'nuxt-og-image:fonts', dir: serverFontsDir })
      }
      addServerHandler({
        lazy: true,
        route: '/_og/f/**',
        handler: resolve(`${basePath}/font`),
      })
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

    // community templates must be copy+pasted!
    if (!config.zeroRuntime || nuxt.options.dev) {
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

    registerTypeTemplates({
      nuxt,
      config,
      components: ogImageComponentCtx.components,
    })

    const cacheEnabled = typeof config.runtimeCacheStorage !== 'undefined' && config.runtimeCacheStorage !== false
    const runtimeCacheStorage = typeof config.runtimeCacheStorage === 'boolean' ? 'default' : config.runtimeCacheStorage.driver
    let baseCacheKey: string | false = runtimeCacheStorage === 'default' ? `/cache/nuxt-og-image/${version}` : `/nuxt-og-image/${version}`
    if (!cacheEnabled)
      baseCacheKey = false
    if (!nuxt.options.dev && config.runtimeCacheStorage && typeof config.runtimeCacheStorage === 'object') {
      nuxt.options.nitro.storage = nuxt.options.nitro.storage || {}
      nuxt.options.nitro.storage['nuxt-og-image'] = config.runtimeCacheStorage
    }

    // Build cache for CI persistence (absolute path)
    const buildCachePath = typeof config.buildCache === 'object' && config.buildCache.base
      ? config.buildCache.base
      : 'node_modules/.cache/nuxt/og-image'
    const buildCacheDir = config.buildCache
      ? resolve(nuxt.options.rootDir, buildCachePath)
      : undefined
    nuxt.hooks.hook('modules:done', async () => {
      // allow other modules to modify runtime data
      const normalisedFonts: FontConfig[] = normaliseFontInput(config.fonts)
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
      const runtimeConfig = <OgImageRuntimeConfig> {
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
        // convert the fonts to uniform type to fix ts issue
        fonts: normalisedFonts,
        hasNuxtIcon: hasNuxtModule('nuxt-icon') || hasNuxtModule('@nuxt/icon'),
        colorPreference,

        // @ts-expect-error runtime type
        isNuxtContentDocumentDriven: !!nuxt.options.content?.documentDriven,
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
