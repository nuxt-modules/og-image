import { readFile, writeFile } from 'node:fs/promises'
import * as fs from 'node:fs'
import type { NitroRouteRules } from 'nitropack'
import {
  addComponent,
  addImports,
  addServerHandler,
  addServerPlugin,
  addTemplate,
  createResolver,
  defineNuxtModule,
  hasNuxtModule,
  useLogger,
} from '@nuxt/kit'
import { execa } from 'execa'
import chalk from 'chalk'
import defu from 'defu'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import { joinURL, parsePath, withBase } from 'ufo'
import { dirname, relative } from 'pathe'
import { tinyws } from 'tinyws'
import sirv from 'sirv'
import type { SatoriOptions } from 'satori'
import { copy, mkdirp, pathExists } from 'fs-extra'
import { globby } from 'globby'
import { installNuxtSiteConfig, updateSiteConfig } from 'nuxt-site-config-kit'
import { provider } from 'std-env'
import { hash } from 'ohash'
import terminate from 'terminate'
import { version } from '../package.json'
import createBrowser from './runtime/nitro/providers/browser/universal'
import { screenshot } from './runtime/browserUtil'
import type { InputFontConfig, OgImageOptions, ScreenshotOptions } from './runtime/types'
import { setupPlaygroundRPC } from './rpc'
import { extractAndNormaliseOgImageOptions } from './runtime/nitro/utils-pure'
import type { RuntimeCompatibilitySchema } from './const'
import { Wasms } from './const'
import { ensureDependencies, getNitroPreset, getNitroProviderCompatibility } from './util'
import { extendTypes } from './kit'

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
  satoriOptions: Partial<SatoriOptions>
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
  /**
   * The url of your site.
   * Used to generate absolute URLs for the og:image.
   *
   * Note: This is only required when prerendering your site.
   *
   * @deprecated Provide `url` through site config instead: `{ site: { url: <value> }}`.
   * This is powered by the `nuxt-site-config` module.
   * @see https://github.com/harlan-zw/nuxt-site-config
   */
  host?: string
  /**
   * The url of your site.
   * Used to generate absolute URLs for the og:image.
   *
   * Note: This is only required when prerendering your site.
   *
   * @deprecated Provide `url` through site config instead: `{ site: { url: <value> }}`.
   * This is powered by the `nuxt-site-config` module.
   * @see https://github.com/harlan-zw/nuxt-site-config
   */
  siteUrl?: string
}

const PATH = '/__nuxt_og_image__'
const PATH_ENTRY = `${PATH}/entry`
const PATH_PLAYGROUND = `${PATH}/client`

export interface ModuleHooks {
  'og-image:config': (config: ModuleOptions) => Promise<void> | void
  'og-image:prerenderScreenshots': (queue: OgImageOptions[]) => Promise<void> | void
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
        provider: 'satori',
        component: 'OgImageTemplateFallback',
        width: 1200,
        height: 630,
        cache: true,
        // default is to cache the image for 1 day (24 hours)
        cacheTtl: 24 * 60 * 60 * 1000,
      },
      componentDirs: ['OgImage', 'OgImageTemplate'],
      runtimeSatori: true,
      runtimeBrowser: nuxt.options.dev,
      fonts: [],
      runtimeCacheStorage: true,
      satoriOptions: {},
      playground: process.env.NODE_ENV === 'development' || nuxt.options.dev,
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
    const { resolve } = createResolver(import.meta.url)

    logger.debug('Using Nitro preset', getNitroPreset())

    const nitroCompatibility = getNitroProviderCompatibility(config.runtimeCompatibility || {})
    logger.debug('Nitro compatibility', nitroCompatibility)

    const nitroTarget = process.env.NITRO_PRESET || nuxt.options.nitro.preset || provider
    if (!nitroCompatibility) {
      logger.warn(`\`nuxt-og-image\` does not support the nitro preset \`${nitroTarget}\`. Please make an issue. `)
      return
    }

    if (!nitroCompatibility.browser && config.runtimeBrowser) {
      config.runtimeBrowser = false
      logger.warn(`\`nuxt-og-image\` does not support the nitro target \`${nitroTarget}\` with the runtime browser. Set runtimeBrowser: false to stop seeing this.`)
    }

    if (config.runtimeBrowser && nitroCompatibility.browser === 'lambda') {
      logger.info(`\`nuxt-og-image\` is deploying to nitro target \`${nitroTarget}\` that installs extra dependencies.`)
      await ensureDependencies(nuxt, ['puppeteer-core@14.1.1', '@sparticuz/chrome-aws-lambda@14.1.1'])
    }

    await installNuxtSiteConfig()
    // allow config fallback
    updateSiteConfig({
      _context: 'nuxt-og-image:config',
      url: config.siteUrl || config.host!,
    })

    nuxt.options.nitro.storage = nuxt.options.nitro.storage || {}
    // provide cache storage for prerendering
    if (nuxt.options._generate) {
      nuxt.options.nitro.storage['og-image'] = {
        driver: 'memory',
      }
    }
    else if (config.runtimeCacheStorage && !nuxt.options.dev && typeof config.runtimeCacheStorage === 'object') {
      nuxt.options.nitro.storage['og-image'] = config.runtimeCacheStorage
    }

    // default font is inter
    if (!config.fonts.length)
      config.fonts = ['Inter:400', 'Inter:700']

    const distResolve = (p: string) => {
      const cwd = resolve('.')
      if (cwd.endsWith('/dist'))
        return resolve(p)
      return resolve(`../dist/${p}`)
    }

    nuxt.options.experimental.componentIslands = true

    extendTypes('nuxt-og-image', ({ typesPath }) => {
      return `
declare module 'nitropack' {
  interface NitroRouteRules {
    ogImage?: false | import('${typesPath}').OgImageOptions
  }
  interface NitroRouteConfig {
    ogImage?: false | import('${typesPath}').OgImageOptions
  }
}`
    })

    addServerHandler({
      lazy: true,
      handler: resolve('./runtime/nitro/middleware/og.png'),
    })

    ;['html', 'options', 'svg', 'vnode', 'font', 'debug']
      .forEach((type) => {
        if (type !== 'debug' || config.debug) {
          addServerHandler({
            lazy: true,
            route: `/api/og-image-${type}`,
            handler: resolve(`./runtime/nitro/routes/${type}`),
          })
        }
      })

    // @ts-ignore runtime type
    nuxt.hook('devtools:customTabs', (iframeTabs) => {
      iframeTabs.push({
        name: 'ogimage',
        title: 'OG Image',
        icon: 'carbon:image-search',
        view: {
          type: 'iframe',
          src: '/__nuxt_og_image__/client/',
        },
      })
    })

    // Setup playground. Only available in development
    if (config.playground) {
      const playgroundDir = distResolve('./client')
      const {
        middleware: rpcMiddleware,
      } = setupPlaygroundRPC(nuxt, config)
      nuxt.hook('vite:serverCreated', async (server) => {
        server.middlewares.use(PATH_ENTRY, tinyws() as any)
        server.middlewares.use(PATH_ENTRY, rpcMiddleware as any)
        // serve the front end in production
        if (await pathExists(playgroundDir))
          server.middlewares.use(PATH_PLAYGROUND, sirv(playgroundDir, { single: true, dev: true }))
      })
      // allow /__og_image__ to be proxied
      addServerHandler({
        handler: resolve('./runtime/nitro/middleware/playground'),
      })
    }

    nuxt.options.optimization.treeShake.composables.client['nuxt-og-image'] = []
    ;[
      // deprecated
      'Dynamic',
      'Static',
      // new
      'index',
      'Cached',
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

    await addComponent({
      name: 'OgImageTemplateFallback',
      filePath: resolve('./runtime/components/OgImageTemplate/Fallback.vue'),
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

    // we're going to expose the og image components to the ssr build so we can fix prop usage
    const ogImageComponents: { pascalName: string; kebabName: string; hash: string }[] = []
    nuxt.hook('components:extend', (components) => {
      // check if the component folder starts with OgImage or OgImageTemplate and set to an island component
      components.forEach((component) => {
        let valid = false
        config.componentDirs.forEach((dir) => {
          if (component.pascalName.startsWith(dir) || component.kebabName.startsWith(dir)
            // support non-prefixed components
            || component.shortPath.includes(`/${dir}/`))
            valid = true
        })
        if (valid || component.pascalName === 'OgImageTemplateFoo') {
          // get hash of the file
          component.island = true
          component.mode = 'server'
          ogImageComponents.push({
            // purge cache when component changes
            hash: hash(fs.readFileSync(component.filePath, 'utf-8')),
            pascalName: component.pascalName,
            kebabName: component.kebabName,
          })
        }
      })
    })
    addTemplate({
      filename: 'og-image-component-names.mjs',
      getContents() {
        return `export const componentNames = ${JSON.stringify(ogImageComponents)}`
      },
      options: { mode: 'server' },
    })

    const runtimeDir = resolve('./runtime')
    nuxt.options.build.transpile.push(runtimeDir)

    addServerPlugin(resolve('./runtime/nitro/plugins/prerender'))

    // get public dir
    const customAssetDirs: string[] = [
      // allows us to show custom error images
      resolve('./runtime/public-assets'),
    ]
    if (config.runtimeSatori) {
      if (config.fonts.includes('Inter:400'))
        customAssetDirs.push(resolve('./runtime/public-assets-optional/inter-font'))
      if (nitroCompatibility.png === 'resvg-wasm' && nitroCompatibility.wasm === 'fetch')
        customAssetDirs.push(resolve('./runtime/public-assets-optional/resvg'))
      else if (nitroCompatibility.png === 'svg2png' && nitroCompatibility.wasm === 'fetch')
        customAssetDirs.push(resolve('./runtime/public-assets-optional/svg2png'))
      if (nitroCompatibility.satori === 'yoga-wasm')
        customAssetDirs.push(resolve('./runtime/public-assets-optional/yoga'))
    }

    nuxt.hooks.hook('modules:done', async () => {
      // allow other modules to modify runtime data
      // @ts-expect-error untyped
      nuxt.hooks.callHook('og-image:config', config)
      nuxt.options.runtimeConfig['nuxt-og-image'] = {
        version,
        satoriOptions: config.satoriOptions,
        runtimeSatori: config.runtimeSatori,
        runtimeBrowser: config.runtimeBrowser,
        // @ts-expect-error runtime type
        defaults: config.defaults,
        // avoid adding credentials
        runtimeCacheStorage: typeof config.runtimeCacheStorage === 'boolean' ? 'default' : config.runtimeCacheStorage.driver,
        // convert the fonts to uniform type to fix ts issue
        fonts: config.fonts.map((f) => {
          if (typeof f === 'string') {
            const [name, weight] = f.split(':')
            return {
              name,
              weight,
            }
          }
          return f
        }),
        assetDirs: [
          resolve(nuxt.options.srcDir, nuxt.options.dir.public),
          ...customAssetDirs,
          // always add runtime dirs for prerendering to work, these are just used as scan roots
          resolve('./runtime/public-assets-optional/inter-font'),
          resolve('./runtime/public-assets-optional/resvg'),
          resolve('./runtime/public-assets-optional/yoga'),
          resolve('./runtime/public-assets-optional/svg2png'),
        ],
      }
    })

    nuxt.hooks.hook('nitro:config', async (nitroConfig) => {
      nitroConfig.externals = defu(nitroConfig.externals || {}, {
        inline: [runtimeDir],
      })

      // stub out dependencies for non-node environments
      if (!nitroCompatibility.node) {
        nitroConfig.alias = nitroConfig.alias || {}
        // playwright-core
        if (config.runtimeBrowser) {
          nitroConfig.alias.electron = 'unenv/runtime/mock/proxy-cjs'
          nitroConfig.alias.bufferutil = 'unenv/runtime/mock/proxy-cjs'
          nitroConfig.alias['utf-8-validate'] = 'unenv/runtime/mock/proxy-cjs'
        }
        // image-size
        nitroConfig.alias.queue = 'unenv/runtime/mock/proxy-cjs'
      }

      // mock the resvg-js dependency in edge runtimes
      if (nitroCompatibility.png === 'resvg-wasm')
        nitroConfig.alias!['@resvg/resvg-js'] = 'unenv/runtime/mock/proxy-cjs'

      nitroConfig.publicAssets = nitroConfig.publicAssets || []
      customAssetDirs.forEach((dir) => {
        nitroConfig.publicAssets!.push({ dir, maxAge: 31536000 })
      })

      const providerPath = `${runtimeDir}/nitro/providers`

      nitroConfig.virtual!['#nuxt-og-image/css-inline'] = `import cssInline from '${providerPath}/css-inline/${nitroCompatibility.cssInline ? 'css-inline' : 'mock'}'
export default function() {
 return cssInline
}
`
      if (config.runtimeBrowser) {
        // browser can only work in node runtime at the moment
        nitroConfig.virtual!['#nuxt-og-image/browser'] = `
let browser
export default async function() {
  browser = browser || await import('${providerPath}/browser/${nitroCompatibility.browser}').then((m) => m.default || m)
  return browser
}
`
      }

      if (config.runtimeSatori) {
        nitroConfig.virtual!['#nuxt-og-image/satori'] = `import satori from '${providerPath}/satori/${nitroCompatibility.satori}'
export default function() {
  return satori
}`

        nitroConfig.virtual!['#nuxt-og-image/png'] = `import png from '${providerPath}/png/${nitroCompatibility.png}'
export default function() {
 return png
}
`
      }

      const rendererPath = `${runtimeDir}/nitro/renderers`
      nitroConfig.virtual!['#nuxt-og-image/provider'] = `
${config.runtimeSatori ? `import satori from '${rendererPath}/satori'` : ''}
${config.runtimeBrowser ? `import browser from '${rendererPath}/browser'` : ''}

export async function useProvider(provider) {
  if (provider === 'satori')
    return ${config.runtimeSatori ? 'satori' : 'null'}
  if (provider === 'browser')
    return ${config.runtimeBrowser ? 'browser' : 'null'}
  return null
}
      `
    })

    nuxt.hooks.hook('nitro:init', async (nitro) => {
      let screenshotQueue: OgImageOptions[] = []

      nitro.hooks.hook('compiled', async (_nitro) => {
        if (!config.runtimeSatori || nuxt.options.dev)
          return
        // Add WASM's and Satori dependencies to the final build
        if (config.fonts.includes('Inter:400'))
          await copy(resolve('./runtime/public-assets-optional/inter-font/inter-latin-ext-400-normal.woff'), resolve(_nitro.options.output.publicDir, 'inter-latin-ext-400-normal.woff'))
        if (config.fonts.includes('Inter:700'))
          await copy(resolve('./runtime/public-assets-optional/inter-font/inter-latin-ext-700-normal.woff'), resolve(_nitro.options.output.publicDir, 'inter-latin-ext-700-normal.woff'))
        // need to replace the token in entry
        const configuredEntry = nitro.options.rollupConfig?.output.entryFileNames
        // .playground/.netlify/functions-internal/server/chunks/rollup/provider.mjs
        const wasmProviderPath = resolve(_nitro.options.output.serverDir, typeof configuredEntry === 'string' ? configuredEntry : 'index.mjs')
        // we don't know where our wasm code is, need to do some scanning
        const paths = [wasmProviderPath]
        const chunks = await globby([`${_nitro.options.output.serverDir}/chunks/**/*.mjs`], { absolute: true })
        paths.push(...chunks)
        for (const path of paths) {
          if (!(await pathExists(path)))
            continue

          let contents = (await readFile(path, 'utf-8'))
          let updated = false
          for (const wasm of Wasms) {
            if (contents.includes(wasm.placeholder)) {
              if (nitroCompatibility.wasm === 'import') {
                // path needs to be relative to the server directory
                contents = contents.replace(wasm.placeholder, `import("./${wasm.file}${nitroCompatibility.wasmImportQuery || ''}").then(m => m.default || m)`)
                // add the wasm here
                await copy(resolve(`./runtime/public-assets-optional/${wasm.path}`), resolve(dirname(path), wasm.file))
              }
              else if (nitroCompatibility.wasm === 'inline') {
                // how do you inline a wasm file in node
                const wasmBuffer = await readFile(resolve(`./runtime/public-assets-optional/${wasm.path}`))
                // convert base 64 buffer to array buffer
                contents = contents.replace(wasm.placeholder, `Buffer.from("${wasmBuffer}", "base64")`)
              }
              updated = true
            }
          }
          if (updated)
            await writeFile(path, contents, { encoding: 'utf-8' })
        }
      })

      const _routeRulesMatcher = toRouteMatcher(
        createRadixRouter({ routes: nitro.options.routeRules }),
      )

      nitro.hooks.hook('prerender:generate', async (ctx) => {
        // avoid scanning files and the og:image route itself
        if (ctx.route.includes('.'))
          return

        const html = ctx.contents

        // we need valid _contents to scan for ogImage options and know the route is good
        if (!html)
          return

        const routeRules: NitroRouteRules = defu({}, ..._routeRulesMatcher.matchAll(ctx.route).reverse())
        const extractedOptions = extractAndNormaliseOgImageOptions(ctx.route, html, routeRules.ogImage || {}, config.defaults)
        if (!extractedOptions || routeRules.ogImage === false)
          return

        const isPageScreenshot = extractedOptions.component === 'PageScreenshot'
        const entry: OgImageOptions = {
          route: parsePath(ctx.route).pathname, // drop hash and query
          path: !isPageScreenshot ? `/api/og-image-html?path=${ctx.route}` : ctx.route,
          ...extractedOptions,
        }

        // dedupe based on path
        if (screenshotQueue.some(r => r.route === entry.route))
          return

        // if we're running `nuxi generate` we prerender everything (including dynamic)
        if ((nuxt.options._generate || entry.cache) && entry.provider === 'browser')
          screenshotQueue.push(entry)
      })

      if (nuxt.options.dev)
        return

      const captureScreenshots = async () => {
        // call hook
        // @ts-expect-error runtime hook
        await nuxt.callHook('og-image:prerenderScreenshots', screenshotQueue)

        if (screenshotQueue.length === 0)
          return

        // avoid problems by installing playwright
        nitro.logger.info('Ensuring chromium install for og:image generation...')
        const installChromeProcess = execa('npx', ['playwright', 'install', 'chromium'], {
          stdio: 'inherit',
        })
        installChromeProcess.stderr?.pipe(process.stderr)
        await new Promise((resolve) => {
          installChromeProcess.on('exit', (e) => {
            if (e !== 0)
              nitro.logger.error('Failed to install Playwright dependency for og:image generation. Trying anyway...')
            resolve(true)
          })
        })
        installChromeProcess.pid && terminate(installChromeProcess.pid)

        // make sure we have a browser
        const browser = await createBrowser()
        if (!browser) {
          nitro.logger.log(chalk.red('Failed to create a browser to create og:images.'))
          return
        }
        nitro.logger.info('Creating server for og:image generation...')
        const previewProcess = execa('npx', ['serve', nitro.options.output.publicDir])
        try {
          // wait until we get a message which says "Accepting connections"
          const host = (await new Promise<string>((resolve) => {
            previewProcess.stdout?.on('data', (data) => {
              if (data.includes('Accepting connections at')) {
                // get the url from data and return it as the promise
                resolve(data.toString().split('Accepting connections at ')[1])
              }
            })
          })).trim()
          previewProcess.removeAllListeners('data')

          nitro.logger.info(`Prerendering ${screenshotQueue.length} og:image screenshots...`)

          // normalise
          for (const k in screenshotQueue) {
            let entry = screenshotQueue[k]
            // allow inserting items into the queue via hook
            if (entry.route && Object.keys(entry).length === 1) {
              const html = await $fetch(entry.route, { baseURL: withBase(nuxt.options.app.baseURL, host) })
              const routeRules: NitroRouteRules = defu({}, ..._routeRulesMatcher.matchAll(entry.route).reverse())
              const extractedOptions = extractAndNormaliseOgImageOptions(entry.route, html as string, routeRules.ogImage || {}, {
                ...config.defaults,
                component: 'PageScreenshot',
              })
              if (!extractedOptions || routeRules.ogImage === false) {
                entry.skip = true
                continue
              }
              screenshotQueue[k] = entry = defu(
                { path: extractedOptions.component !== 'PageScreenshot' ? `/api/og-image-html?path=${entry.route}` : entry.route } as Partial<OgImageOptions>,
                entry,
                extractedOptions,
              )
            }
            // if we're rendering a component let's fetch the html, it will have everything we need
            if (!entry.skip && entry.component !== 'PageScreenshot')
              entry.html = await globalThis.$fetch(entry.path)
          }

          for (const k in screenshotQueue) {
            const entry = screenshotQueue[k]
            if (entry.skip)
              continue
            const start = Date.now()
            let hasError = false
            const dirname = joinURL(nitro.options.output.publicDir, entry.route, '/__og_image__/')
            const filename = joinURL(dirname, '/og.png')
            try {
              const imgBuffer = await screenshot(browser, {
                ...(config.defaults as ScreenshotOptions || {}),
                ...(entry || {}),
                host,
              })
              try {
                await mkdirp(dirname)
              }
              catch (e) {}
              await writeFile(filename, imgBuffer)
            }
            catch (e) {
              hasError = true
              console.error(e)
            }
            const generateTimeMS = Date.now() - start
            nitro.logger.log(chalk[hasError ? 'red' : 'gray'](
              `  ${Number(k) === screenshotQueue.length - 1 ? '└─' : '├─'} /${relative(nitro.options.output.publicDir, filename)} (${generateTimeMS}ms) ${Math.round((Number(k) + 1) / (screenshotQueue.length) * 100)}%`,
            ))
          }
        }
        catch (e) {
          console.error(e)
        }
        finally {
          await browser?.close()
          previewProcess.pid && terminate(previewProcess.pid)
        }
        screenshotQueue = []
      }

      // SSR mode
      nitro.hooks.hook('rollup:before', async () => {
        await captureScreenshots()
      })

      // SSG mode
      nitro.hooks.hook('close', async () => {
        await captureScreenshots()
      })
    })
  },
})
