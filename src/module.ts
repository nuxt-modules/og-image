import * as fs from 'node:fs'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import {
  type AddComponentOptions,
  addComponent,
  addComponentsDir,
  addImports,
  addPlugin,
  addServerHandler,
  addServerPlugin,
  addTemplate,
  createResolver,
  defineNuxtModule,
  hasNuxtModule,
  tryResolveModule,
  useLogger,
} from '@nuxt/kit'
import type { SatoriOptions } from 'satori'
import { installNuxtSiteConfig } from 'nuxt-site-config-kit'
import { isDevelopment } from 'std-env'
import { hash } from 'ohash'
import { basename, join, relative } from 'pathe'
import type { ResvgRenderOptions } from '@resvg/resvg-js'
import type { SharpOptions } from 'sharp'
import { defu } from 'defu'
import { readPackageJSON } from 'pkg-types'
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import { withoutLeadingSlash } from 'ufo'
import type {
  CompatibilityFlagEnvOverrides,
  FontConfig,
  InputFontConfig,
  OgImageComponent,
  OgImageOptions,
  OgImageRuntimeConfig,
  RuntimeCompatibilitySchema,
} from './runtime/types'
import {
  ensureDependencies,
  getPresetNitroPresetCompatibility,
  resolveNitroPreset,
} from './compatibility'
import { extendTypes, getNuxtModuleOptions, isNuxtGenerate } from './kit'
import { setupDevToolsUI } from './build/devtools'
import { setupDevHandler } from './build/dev'
import { setupGenerateHandler } from './build/generate'
import { setupPrerenderHandler } from './build/prerender'
import { setupBuildHandler } from './build/build'
import { checkLocalChrome, checkPlaywrightDependency, downloadFont, isUndefinedOrTruthy } from './util'
import { normaliseFontInput } from './pure'

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
   * @default { component: 'OgImageTemplateFallback', width: 1200, height: 630, cache: true, cacheTtl: 24 * 60 * 60 * 1000 }
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
   * @default ['OgImage', 'OgImageTemplate']
   */
  componentDirs: string[]
  /**
   * Manually modify the compatibility.
   */
  compatibility?: CompatibilityFlagEnvOverrides
  /**
   * Use an alternative host for downloading Google Fonts. This is used to support China where Google Fonts is blocked.
   *
   * When `true` is set will use `fonts.font.im`, otherwise will use a string as the host.
   */
  googleFontMirror?: true | string
}

export interface ModuleHooks {
  'nuxt-og-image:components': (ctx: { components: OgImageComponent[] }) => Promise<void> | void
  'nuxt-og-image:runtime-config': (config: ModuleOptions) => Promise<void> | void
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-og-image',
    compatibility: {
      nuxt: '>=3.10.3',
      bridge: false,
    },
    configKey: 'ogImage',
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
      componentDirs: ['OgImage', 'OgImageTemplate'],
      fonts: [],
      runtimeCacheStorage: true,
      debug: isDevelopment,
    }
  },
  async setup(config, nuxt) {
    const { resolve } = createResolver(import.meta.url)
    const { name, version } = await readPackageJSON(resolve('../package.json'))
    const logger = useLogger(name)
    logger.level = (config.debug || nuxt.options.debug) ? 4 : 3
    if (config.enabled === false) {
      logger.debug('The module is disabled, skipping setup.')
      // need to mock the composables to allow module still to work when disabled
      ;['defineOgImage', 'defineOgImageComponent', 'defineOgImageScreenshot']
        .forEach((name) => {
          addImports({ name, from: resolve(`./runtime/nuxt/composables/mock`) })
        })
      return
    }
    if (config.enabled && !nuxt.options.ssr) {
      logger.warn('Nuxt OG Image is enabled but SSR is disabled.\n\nYou should enable SSR (`ssr: true`) or disable the module (`ogImage: { enabled: false }`).')
      return
    }

    nuxt.options.build.transpile.push(resolve('./runtime'))

    const preset = resolveNitroPreset(nuxt.options.nitro)
    const targetCompatibility = getPresetNitroPresetCompatibility(preset)

    let isUsingSharp = false
    // avoid any sharp logic if user explicitly opts-out
    const userConfiguredExtension = config.defaults.extension
    const hasConfiguredJpegs = userConfiguredExtension && ['jpeg', 'jpg'].includes(userConfiguredExtension)
    if (!!config.sharpOptions || (hasConfiguredJpegs && config.defaults.renderer !== 'chromium')) {
      isUsingSharp = true
      const hasSharpDependency = !!(await tryResolveModule('sharp'))
      if (hasSharpDependency && !targetCompatibility.sharp) {
        logger.warn(`Rendering JPEGs requires sharp which does not work with ${preset}. Images will be rendered as PNG at runtime.`)
        config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
          runtime: { sharp: false },
        })
      }
      else if (!hasSharpDependency) {
        // sharp is supported but not installed
        logger.warn('You have enabled `JPEG` images. These require the `sharp` dependency which is missing, installing it for you.')
        await ensureDependencies(['sharp'])
        logger.warn('Support for `sharp` is limited so check the compatibility guide.')
      }
    }
    if (!isUsingSharp) {
      // disable sharp
      config.compatibility = defu(config.compatibility, <CompatibilityFlagEnvOverrides>{
        runtime: { sharp: false },
        dev: { sharp: false },
        prerender: { sharp: false },
      })
    }

    // in dev and prerender we rely on local chrome or playwright dependency
    // for runtime we need playwright dependency
    const hasChromeLocally = checkLocalChrome()
    const hasPlaywrightDependency = await checkPlaywrightDependency()
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

    await installNuxtSiteConfig()

    // convert ogImage key to head data
    if (hasNuxtModule('@nuxt/content'))
      addServerPlugin(resolve('./runtime/nitro/plugins/nuxt-content'))

    // default font is inter
    if (!config.fonts.length) {
      config.fonts = [
        { name: 'Inter', weight: 400, path: resolve('./runtime/assets/Inter-400.ttf.base64'), absolutePath: true },
        { name: 'Inter', weight: 700, path: resolve('./runtime/assets/Inter-700.ttf.base64'), absolutePath: true },
      ]
    }

    const serverFontsDir = resolve(nuxt.options.buildDir, 'cache', `nuxt-og-image@${version}`, '_fonts')
    // mkdir@
    const fontStorage = createStorage({
      driver: fsDriver({
        base: serverFontsDir,
      }),
    })
    config.fonts = (await Promise.all(normaliseFontInput(config.fonts)
      .map(async (f) => {
        if (!f.key && !f.path) {
          if (preset === 'stackblitz') {
            logger.warn(`The ${f.name}:${f.weight} font was skipped because remote fonts are not available in StackBlitz, please use a local font.`)
            return false
          }
          if (await downloadFont(f, fontStorage, config.googleFontMirror)) {
            // move file to serverFontsDir
            f.key = `nuxt-og-image:fonts:${f.name}-${f.weight}.ttf.base64`
          }
          else {
            logger.warn(`Failed to download font ${f.name}:${f.weight}. You may be offline or behind a firewall blocking Google. Consider setting \`googleFontMirror: true\`.`)
            return false
          }
        }
        else if (f.path) {
          // validate the extension, can only be woff, ttf or otf
          const extension = basename(f.path.replace('.base64', '')).split('.').pop()!
          if (!['woff', 'ttf', 'otf'].includes(extension)) {
            logger.warn(`The ${f.name}:${f.weight} font was skipped because the file extension ${extension} is not supported. Only woff, ttf and otf are supported.`)
            return false
          }
          // resolve relative paths from public dir
          // move to assets folder as base64 and set key
          if (!f.absolutePath)
            f.path = join(nuxt.options.rootDir, nuxt.options.dir.public, withoutLeadingSlash(f.path))
          if (!existsSync(f.path)) {
            logger.warn(`The ${f.name}:${f.weight} font was skipped because the file does not exist at path ${f.path}.`)
            return false
          }
          const fontData = await readFile(f.path, f.path.endsWith('.base64') ? 'utf-8' : 'base64')
          f.key = `nuxt-og-image:fonts:${f.name}-${f.weight}.${extension}.base64`
          await fontStorage.setItem(`${f.name}-${f.weight}.${extension}.base64`, fontData)
          delete f.path
          delete f.absolutePath
        }
        return f
      }))).filter(Boolean) as InputFontConfig[]

    // bundle fonts within nitro runtime
    nuxt.options.nitro.serverAssets = nuxt.options.nitro.serverAssets || []
    nuxt.options.nitro.serverAssets!.push({ baseName: 'nuxt-og-image:fonts', dir: serverFontsDir })

    nuxt.options.experimental.componentIslands = true

    addServerHandler({
      lazy: true,
      route: '/__og-image__/font/**',
      handler: resolve('./runtime/nitro/routes/font'),
    })
    if (config.debug || nuxt.options.dev) {
      addServerHandler({
        lazy: true,
        route: '/__og-image__/debug.json',
        handler: resolve('./runtime/nitro/routes/debug.json'),
      })
    }
    addServerHandler({
      lazy: true,
      route: '/__og-image__/image/**',
      handler: resolve('./runtime/nitro/routes/image'),
    })

    nuxt.options.optimization.treeShake.composables.client['nuxt-og-image'] = []
    ;['defineOgImage', 'defineOgImageComponent', 'defineOgImageScreenshot']
      .forEach((name) => {
        addImports({
          name,
          from: resolve(`./runtime/nuxt/composables/${name}`),
        })
        nuxt.options.optimization.treeShake.composables.client['nuxt-og-image'].push(name)
      })

    await addComponentsDir({
      path: resolve('./runtime/nuxt/components/Templates/Community'),
      island: true,
      watch: true,
    })

    ;[
      // new
      'OgImage',
      'OgImageScreenshot',
    ]
      .forEach((name) => {
        addComponent({
          name,
          filePath: resolve(`./runtime/nuxt/components/OgImage/${name}`),
          ...config.componentOptions,
        })
      })

    // allows us to add og images using route rules without calling defineOgImage
    addPlugin({ mode: 'server', src: resolve('./runtime/nuxt/plugins/route-rule-og-image.server') })
    addPlugin({ mode: 'server', src: resolve('./runtime/nuxt/plugins/og-image-canonical-urls.server') })

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
        if (component.filePath.includes(resolve('./runtime/nuxt/components/Templates')))
          valid = true

        if (valid && fs.existsSync(component.filePath)) {
          // get hash of the file
          component.island = true
          component.mode = 'server'
          validComponents.push(component)
          let category: OgImageComponent['category'] = 'app'
          if (component.filePath.includes(resolve('./runtime/nuxt/components/Templates/Community')))
            category = 'community'
          const componentFile = fs.readFileSync(component.filePath, 'utf-8')
          // see if we can extract credits from the component file, just find the line that starts with * @credits and return the rest of the line
          const credits = componentFile.split('\n').find(line => line.startsWith(' * @credits'))?.replace('* @credits', '').trim()
          ogImageComponentCtx.components.push({
            // purge cache when component changes
            hash: hash(componentFile),
            pascalName: component.pascalName,
            kebabName: component.kebabName,
            path: nuxt.options.dev ? component.filePath : undefined,
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
    nuxt.options.nitro.virtual['#nuxt-og-image/component-names.mjs'] = () => {
      return `export const componentNames = ${JSON.stringify(ogImageComponentCtx.components)}`
    }

    // support simple theme extends
    let unoCssConfig: any = {}
    // @ts-expect-error module optional
    nuxt.hook('tailwindcss:config', (tailwindConfig) => {
      unoCssConfig = defu(tailwindConfig.theme?.extend, { ...tailwindConfig.theme, extend: undefined })
    })
    // @ts-expect-error module optional
    nuxt.hook('unocss:config', (_unoCssConfig) => {
      unoCssConfig = { ..._unoCssConfig.theme }
    })
    nuxt.options.nitro.virtual['#nuxt-og-image/unocss-config.mjs'] = () => {
      return `export const theme = ${JSON.stringify(unoCssConfig)}`
    }

    extendTypes('nuxt-og-image', ({ typesPath }) => {
      // need to map our components to types so we can import them
      const componentImports = ogImageComponentCtx.components.map((component) => {
        const relativeComponentPath = relative(resolve(nuxt!.options.rootDir, nuxt!.options.buildDir, 'module'), component.path!)
        // remove dirNames from component name
        const name = config.componentDirs
          // need to sort by longest first so we don't replace the wrong part of the string
          .sort((a, b) => b.length - a.length)
          .reduce((name, dir) => {
            // only replace from the start of the string
            return name.replace(new RegExp(`^${dir}`), '')
          }, component.pascalName)
        return `    '${name}': typeof import('${relativeComponentPath}')['default']`
      }).join('\n')
      return `
declare module 'nitropack' {
  interface NitroRouteRules {
    ogImage?: false | import('${typesPath}').OgImageOptions & Record<string, any>
  }
  interface NitroRouteConfig {
    ogImage?: false | import('${typesPath}').OgImageOptions & Record<string, any>
  }
  interface NitroRuntimeHooks {
    'nuxt-og-image:context': (ctx: import('${typesPath}').OgImageRenderEventContext) => void | Promise<void>
    'nuxt-og-image:satori:vnodes': (vnodes: import('${typesPath}').VNode, ctx: import('${typesPath}').OgImageRenderEventContext) => void | Promise<void>
  }
}

declare module '#nuxt-og-image/components' {
  export interface OgImageComponents {
${componentImports}
  }
}
declare module '#nuxt-og-image/unocss-config' {
  export type theme = any
}
`
    })

    const cacheEnabled = typeof config.runtimeCacheStorage !== 'undefined' && config.runtimeCacheStorage !== false
    const runtimeCacheStorage = typeof config.runtimeCacheStorage === 'boolean' ? 'default' : config.runtimeCacheStorage.driver
    let baseCacheKey: string | false = runtimeCacheStorage === 'default' ? `/cache/nuxt-og-image@${version}` : `/nuxt-og-image/${version}`
    if (!cacheEnabled)
      baseCacheKey = false
    if (!nuxt.options.dev && config.runtimeCacheStorage && typeof config.runtimeCacheStorage === 'object') {
      nuxt.options.nitro.storage = nuxt.options.nitro.storage || {}
      nuxt.options.nitro.storage['nuxt-og-image'] = config.runtimeCacheStorage
    }
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

        defaults: config.defaults,
        debug: config.debug,
        // avoid adding credentials
        baseCacheKey,
        // convert the fonts to uniform type to fix ts issue
        fonts: normalisedFonts,
        hasNuxtIcon: hasNuxtModule('nuxt-icon'),
        colorPreference,

        // @ts-expect-error runtime type
        isNuxtContentDocumentDriven: !!nuxt.options.content?.documentDriven,
      }
      // @ts-expect-error untyped
      nuxt.hooks.callHook('nuxt-og-image:runtime-config', runtimeConfig)
      // @ts-expect-error runtime types
      nuxt.options.runtimeConfig['nuxt-og-image'] = runtimeConfig
    })

    // Setup playground. Only available in development
    if (nuxt.options.dev) {
      setupDevHandler(config, resolve)
      setupDevToolsUI(config, resolve)
    }
    else if (isNuxtGenerate()) {
      setupGenerateHandler(config, resolve)
    }
    else if (nuxt.options.build) {
      await setupBuildHandler(config, resolve)
    }
    // no way to know if we'll prerender any routes
    if (nuxt.options.build)
      addServerPlugin(resolve('./runtime/nitro/plugins/prerender'))
    // always call this as we may have routes only discovered at build time
    setupPrerenderHandler(config, resolve)
  },
})
