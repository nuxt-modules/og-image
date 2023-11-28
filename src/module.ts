import * as fs from 'node:fs'
import {
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
  useLogger,
} from '@nuxt/kit'
import type { SatoriOptions } from 'satori'
import { installNuxtSiteConfig } from 'nuxt-site-config-kit'
import { env } from 'std-env'
import { hash } from 'ohash'
import { relative } from 'pathe'
import type { ResvgRenderOptions } from '@resvg/resvg-js'
import type { SharpOptions } from 'sharp'
import { version } from '../package.json'
import type { FontConfig, InputFontConfig, OgImageComponent, OgImageOptions } from './runtime/types'
import { type RuntimeCompatibilitySchema, getPresetNitroPresetCompatibility, resolveNitroPreset } from './compatibility'
import { extendTypes } from './kit'
import { setupDevToolsUI } from './build/devtools'
import { setupDevHandler } from './build/dev'
import { setupGenerateHandler } from './build/generate'
import { setupPrerenderHandler } from './build/prerender'
import { setupBuildHandler } from './build/build'

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
   * @example ['Roboto:400,700', { path: 'path/to/font.ttf', weight: 400, name: 'MyFont' }]
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
  sharpOptions?: Partial<SharpOptions>
  /**
   * Should the playground at <path>/__og_image__ be enabled in development.
   *
   * @default true
   */
  playground: boolean
  /**
   * Include Satori runtime.
   *
   * @default true
   */
  runtimeSatori: boolean
  /**
   * Include the Browser runtime.
   * This will need to be manually enabled for production environments.
   *
   * @default `process.dev`
   */
  runtimeBrowser: boolean
  /**
   * Enables debug logs and a debug endpoint.
   *
   * @false false
   */
  debug: boolean
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
   * Manually modify the deployment compatibility.
   */
  runtimeCompatibility?: Partial<RuntimeCompatibilitySchema>
}

export interface ModuleHooks {
  'nuxt-og-image:components': (ctx: { components: OgImageComponent[] }) => Promise<void> | void
  'og-image:config': (config: ModuleOptions) => Promise<void> | void
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-og-image',
    compatibility: {
      nuxt: '^3.7.0',
      bridge: false,
    },
    configKey: 'ogImage',
  },
  defaults(nuxt) {
    return {
      enabled: true,
      defaults: {
        renderer: 'satori',
        component: 'Fallback',
        width: 1200,
        height: 600,
        cache: true,
        // default is to cache the image for 1 day (24 hours)
        cacheTtl: 24 * 60 * 60 * 1000,
      },
      componentDirs: ['OgImage', 'OgImageTemplate'],
      runtimeSatori: true,
      runtimeBrowser: nuxt.options.dev,
      fonts: [],
      runtimeCacheStorage: true,
      playground: env.NODE_ENV === 'development' || nuxt.options.dev,
      debug: false,
    }
  },
  async setup(config, nuxt) {
    const logger = useLogger('nuxt-og-image')
    logger.level = (config.debug || nuxt.options.debug) ? 4 : 3
    if (config.enabled === false) {
      logger.debug('The module is disabled, skipping setup.')
      return
    }
    if (config.enabled && !nuxt.options.ssr) {
      logger.warn('Nuxt OG Image is enabled but SSR is disabled.\n\nYou should enable SSR (`ssr: true`) or disable the module (`ogImage: { enabled: false }`).')
      return
    }
    const { resolve } = createResolver(import.meta.url)

    const preset = resolveNitroPreset(nuxt.options.nitro)
    const compatibility = getPresetNitroPresetCompatibility(preset)
    config.defaults.extension = 'jpg'
    if (!compatibility.bindings.sharp)
      config.defaults.extension = 'png'

    // TODO use png if if weren't not using a node-based env

    await installNuxtSiteConfig()

    // convert ogImage key to head data
    if (hasNuxtModule('@nuxt/content')) {
      addServerPlugin(resolve('./runtime/nitro/plugins/nuxt-content'))
      addPlugin(resolve('./runtime/nuxt/plugins/nuxt-content-canonical-urls'))
    }

    // default font is inter
    if (!config.fonts.length)
      config.fonts = ['Inter:400', 'Inter:700']

    nuxt.options.experimental.componentIslands = true

    addServerHandler({
      lazy: true,
      route: '/__og-image__/font/**',
      handler: resolve('./runtime/server/routes/__og-image__/font-[name]-[weight].[extension]'),
    })
    if (config.debug || nuxt.options.dev) {
      addServerHandler({
        lazy: true,
        route: '/__og-image__/debug.json',
        handler: resolve('./runtime/server/routes/__og-image__/debug.json'),
      })
    }
    addServerHandler({
      lazy: true,
      route: '/__og-image__/image/**',
      handler: resolve('./runtime/server/routes/__og-image__/image-[path]-og.[extension]'),
    })

    nuxt.options.optimization.treeShake.composables.client['nuxt-og-image'] = []
    ;[
      // deprecated
      'Dynamic',
      'Static',
      // new
      'index',
      'Cached',
      'Component',
      'WithoutCache',
      'Screenshot',
    ]
      .forEach((name) => {
        name = name === 'index' ? 'defineOgImage' : `defineOgImage${name}`
        addImports({
          name,
          from: resolve('./runtime/composables/defineOgImage'),
        })
        nuxt.options.optimization.treeShake.composables.client['nuxt-og-image'].push(name)
      })

    await addComponentsDir({
      path: resolve('./runtime/components/Templates/Community'),
      island: true,
    })
    await addComponentsDir({
      path: resolve('./runtime/components/Templates/Official'),
      island: true,
    })

    ;[
      // deprecated
      'Static',
      'Dynamic',
      // new
      'index',
      'Cached',
      'WithoutCache',
      'Screenshot',
    ]
      .forEach((name) => {
        addComponent({
          global: hasNuxtModule('@nuxt/content'),
          name: name === 'index' ? 'OgImage' : `OgImage${name}`,
          filePath: resolve(`./runtime/components/OgImage/${name}`),
        })
      })

    // allows us to add og images using route rules without calling defineOgImage
    addPlugin(resolve('./runtime/nuxt/plugins/route-rule-og-image.server'))

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
            || component.shortPath.includes(`/${dir}/`))
            valid = true
        })
        if (component.filePath.includes(resolve('./runtime/components/Templates')))
          valid = true

        if (valid && fs.existsSync(component.filePath)) {
          // get hash of the file
          component.island = true
          component.mode = 'server'
          validComponents.push(component)
          let category: OgImageComponent['category'] = 'app'
          if (component.filePath.includes(resolve('./runtime/components/Templates/Community')))
            category = 'community'
          else if (component.filePath.includes(resolve('./runtime/components/Templates/Official')))
            category = 'official'
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
      filename: 'og-image-component-names.mjs',
      getContents() {
        return `export const componentNames = ${JSON.stringify(ogImageComponentCtx.components)}`
      },
      options: { mode: 'server' },
    })
    nuxt.options.nitro.virtual = nuxt.options.nitro.virtual || {}
    nuxt.options.nitro.virtual['#nuxt-og-image/component-names.mjs'] = () => {
      return `export const componentNames = ${JSON.stringify(ogImageComponentCtx.components)}`
    }

    extendTypes('nuxt-og-image', ({ typesPath }) => {
      // need to map our components to types so we can import them
      const componentImports = ogImageComponentCtx.components.map((component) => {
        const relativeComponentPath = relative(resolve(nuxt!.options.rootDir, nuxt!.options.buildDir, 'module'), component.path!)
        return `    '${component.pascalName}': typeof import('${relativeComponentPath}')['default']`
      }).join('\n')
      return `
declare module 'nitropack' {
  interface NitroRouteRules {
    ogImage?: false | import('${typesPath}').OgImageOptions
  }
  interface NitroRouteConfig {
    ogImage?: false | import('${typesPath}').OgImageOptions
  }
}
declare module '#nuxt-og-image/components' {
  export interface OgImageComponents {
${componentImports}
  }
}
`
    })

    nuxt.hooks.hook('modules:done', async () => {
      // allow other modules to modify runtime data
      // @ts-expect-error untyped
      nuxt.hooks.callHook('og-image:config', config)
      const normalisedFonts: FontConfig[] = config.fonts.map((f) => {
        if (typeof f === 'string') {
          const [name, weight] = f.split(':')
          return <FontConfig>{
            name,
            weight,
            path: undefined,
          }
        }
        return f as FontConfig
      })
      if (!nuxt.options._generate && nuxt.options.build) {
        nuxt.options.nitro.prerender = nuxt.options.nitro.prerender || {}
        nuxt.options.nitro.prerender.routes = nuxt.options.nitro.prerender.routes || []
        normalisedFonts
          // if they have a path we can always access them locally
          .filter(f => !f.path)
          .forEach(({ name, weight }) => {
            nuxt.options.nitro.prerender!.routes!.push(`/__og-image__/font/${name}/${weight}.ttf`)
          })
      }
      nuxt.options.runtimeConfig['nuxt-og-image'] = {
        version,
        // binding options
        satoriOptions: config.satoriOptions || {},
        resvgOptions: config.resvgOptions || {},
        sharpOptions: config.sharpOptions || {},

        runtimeSatori: config.runtimeSatori,
        runtimeBrowser: config.runtimeBrowser,
        // @ts-expect-error runtime type
        defaults: config.defaults,
        // avoid adding credentials
        runtimeCacheStorage: typeof config.runtimeCacheStorage === 'boolean' ? 'default' : config.runtimeCacheStorage.driver,
        // convert the fonts to uniform type to fix ts issue
        fonts: normalisedFonts,
        hasNuxtIcon: hasNuxtModule('nuxt-icon'),
      }
    })

    nuxt.options.nitro.experimental = nuxt.options.nitro.experimental || {}
    nuxt.options.nitro.experimental.wasm = true

    // Setup playground. Only available in development
    if (nuxt.options.dev) {
      setupDevHandler(config, resolve)
      setupDevToolsUI(config, resolve)
    }
    else if (nuxt.options._generate) {
      setupGenerateHandler(config, resolve)
    }
    else if (nuxt.options.build) {
      await setupBuildHandler(config, resolve)
    }
    // if prerendering
    if (nuxt.options.nitro.prerender?.routes || nuxt.options._generate)
      setupPrerenderHandler(config, resolve)
  },
})
