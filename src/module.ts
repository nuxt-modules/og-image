import { readFile, writeFile } from 'node:fs/promises'
import type { NitroRouteRules } from 'nitropack'
import {
  addComponent,
  addImports,
  addServerHandler, addServerPlugin,
  addTemplate,
  createResolver,
  defineNuxtModule, useLogger,
} from '@nuxt/kit'
import { execa } from 'execa'
import chalk from 'chalk'
import defu from 'defu'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import { joinURL, withBase } from 'ufo'
import { dirname, relative } from 'pathe'
import type { Browser } from 'playwright-core'
import { tinyws } from 'tinyws'
import sirv from 'sirv'
import type { SatoriOptions } from 'satori'
import { copy, mkdirp, pathExists } from 'fs-extra'
import { globby } from 'globby'
import createBrowser from './runtime/nitro/providers/browser/universal'
import { screenshot } from './runtime/browserUtil'
import type { FontConfig, OgImageOptions, ScreenshotOptions } from './types'
import { setupPlaygroundRPC } from './rpc'
import { extractOgImageOptions } from './runtime/nitro/utils-pure'
import { Wasms } from './const'
import { ensureDependencies, getNitroPreset, getNitroProviderCompatibility } from './util'

export interface ModuleOptions {
  /**
   * The hostname of your website.
   * @deprecated use `siteUrl`
   */
  host?: string
  /**
   * The hostname of your website. Only needed when pre-rendering pages.
   */
  siteUrl?: string
  defaults: OgImageOptions
  fonts: FontConfig[]
  satoriOptions: Partial<SatoriOptions>
  playground: boolean
  runtimeSatori: boolean
  runtimeBrowser: boolean
  /**
   * Enables debug logs and a debug endpoint.
   */
  debug: boolean
  runtimeCacheStorage: boolean | (Record<string, any> & {
    driver: string
  })
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
      nuxt: '^3.3.1',
      bridge: false,
    },
    configKey: 'ogImage',
  },
  defaults(nuxt) {
    const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || process.env.NUXT_SITE_URL || nuxt.options.runtimeConfig.public?.siteUrl || nuxt.options.runtimeConfig.siteUrl
    return {
      siteUrl,
      defaults: {
        component: 'OgImageBasic',
        width: 1200,
        height: 630,
        cacheTtl: 24 * 60 * 60 * 1000, // default is to cache the image for 24 hours
      },
      runtimeSatori: true,
      runtimeBrowser: nuxt.options.dev,
      fonts: [],
      runtimeCacheStorage: false,
      satoriOptions: {},
      playground: process.env.NODE_ENV === 'development' || nuxt.options.dev,
      debug: false,
    }
  },
  async setup(config, nuxt) {
    const logger = useLogger('nuxt-og-image')
    logger.level = config.debug ? 4 : 3
    const { resolve } = createResolver(import.meta.url)

    logger.debug('Using Nitro preset', getNitroPreset(nuxt))

    const nitroCompatibility = getNitroProviderCompatibility(nuxt)
    logger.debug('Nitro compatibility', nitroCompatibility)

    if (!nitroCompatibility) {
      const target = process.env.NITRO_PRESET || nuxt.options.nitro.preset
      logger.warn(`It looks like the nitro target ${target} doesn't support \`nuxt-og-image\`.`)
      return
    }

    if (!nitroCompatibility.browser && config.runtimeBrowser) {
      config.runtimeBrowser = false
      logger.warn('It looks like you\'re using a nitro target that does not support the browser provider, disabling `runtimeBrowser`.')
    }

    if (config.runtimeBrowser && nitroCompatibility.browser === 'lambda') {
      logger.info('It looks like you\'re deploying to an environment that has extra requirements, checking for dependencies...')
      await ensureDependencies(nuxt, ['puppeteer-core@14.1.1', '@sparticuz/chrome-aws-lambda@14.1.1'])
    }

    // allow config fallback
    config.siteUrl = config.siteUrl || config.host!
    if (!nuxt.options.dev && nuxt.options._generate && !config.siteUrl)
      logger.warn('Missing `ogImage.siteUrl` and site is being prerendered. This will result in broken og images.')

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

    // paths.d.ts
    addTemplate({
      filename: 'nuxt-og-image.d.ts',
      getContents: () => {
        return `// Generated by nuxt-og-image
interface NuxtOgImageNitroRules {
  ogImage?: false | Record<string, any>
}
declare module 'nitropack' {
  interface NitroRouteRules extends NuxtOgImageNitroRules {}
  interface NitroRouteConfig extends NuxtOgImageNitroRules {}
}
export {}
`
      },
    })

    nuxt.hooks.hook('prepare:types', ({ references }) => {
      references.push({ path: resolve(nuxt.options.buildDir, 'nuxt-og-image.d.ts') })
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

    // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
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
    ;['defineOgImageDynamic', 'defineOgImageStatic', 'defineOgImageScreenshot']
      .forEach((name) => {
        addImports({
          name,
          from: resolve('./runtime/composables/defineOgImage'),
        })
        nuxt.options.optimization.treeShake.composables.client['nuxt-og-image'].push(name)
      })

    await addComponent({
      name: 'OgImageBasic',
      filePath: resolve('./runtime/components/OgImageBasic.island.vue'),
      island: true,
    })

    ;['OgImageStatic', 'OgImageDynamic', 'OgImageScreenshot']
      .forEach((name) => {
        addComponent({
          name,
          filePath: resolve(`./runtime/components/${name}`),
        })
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
      // @ts-expect-error untyped
      nuxt.options.runtimeConfig['nuxt-og-image'] = {
        ...config,
        // avoid adding credentials
        runtimeCacheStorage: Boolean(config.runtimeCacheStorage),
        assetDirs: [
          resolve(nuxt.options.rootDir, nuxt.options.dir.public),
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

      if (config.runtimeBrowser) {
        nitroConfig.alias = nitroConfig.alias || {}
        nitroConfig.alias.electron = 'unenv/runtime/mock/proxy-cjs'
        nitroConfig.alias.bufferutil = 'unenv/runtime/mock/proxy-cjs'
        nitroConfig.alias['utf-8-validate'] = 'unenv/runtime/mock/proxy-cjs'
      }

      nitroConfig.publicAssets = nitroConfig.publicAssets || []
      customAssetDirs.forEach((dir) => {
        nitroConfig.publicAssets!.push({ dir, maxAge: 31536000 })
      })

      const providerPath = `${runtimeDir}/nitro/providers`

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
export default async function() {
  return satori
}`

        nitroConfig.virtual!['#nuxt-og-image/png'] = `import png from '${providerPath}/png/${nitroCompatibility.png}'
export default async function() {
 return png
}
`
      }

      nitroConfig.virtual!['#nuxt-og-image/provider'] = `
${config.runtimeSatori ? `import satori from '${relative(nuxt.options.rootDir, resolve('./runtime/nitro/renderers/satori'))}'` : ''}
${config.runtimeBrowser ? `import browser from '${relative(nuxt.options.rootDir, resolve('./runtime/nitro/renderers/browser'))}'` : ''}

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
          // fix for vercel
          if (_nitro.options.preset.includes('vercel') && path === wasmProviderPath) {
            contents = contents.replace('.cwd(),', '?.cwd || "/",')
            updated = true
          }

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

        const extractedOptions = extractOgImageOptions(html)
        const routeRules: NitroRouteRules = defu({}, ..._routeRulesMatcher.matchAll(ctx.route).reverse())
        if (!extractedOptions || routeRules.ogImage === false)
          return

        const entry: OgImageOptions = {
          route: ctx.route,
          path: extractedOptions.component ? `/api/og-image-html?path=${ctx.route}` : ctx.route,
          ...extractedOptions,
          ...(routeRules.ogImage || {}),
        }

        // if we're running `nuxi generate` we prerender everything (including dynamic)
        if ((nuxt.options._generate || entry.static) && entry.provider === 'browser')
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

        const previewProcess = execa('npx', ['serve', nitro.options.output.publicDir])
        let browser: Browser | null = null
        try {
          previewProcess.stderr?.pipe(process.stderr)
          // wait until we get a message which says "Accepting connections"
          const host = (await new Promise<string>((resolve) => {
            previewProcess.stdout?.on('data', (data) => {
              if (data.includes('Accepting connections at')) {
                // get the url from data and return it as the promise
                resolve(data.toString().split('Accepting connections at ')[1])
              }
            })
          })).trim()
          browser = await createBrowser()
          if (browser) {
            nitro.logger.info(`Prerendering ${screenshotQueue.length} og:image screenshots...`)

            // normalise
            for (const entry of screenshotQueue) {
              // allow inserting items into the queue via hook
              if (entry.route && Object.keys(entry).length === 1) {
                const html = await $fetch(entry.route, { baseURL: withBase(nuxt.options.app.baseURL, host) })
                const extractedOptions = extractOgImageOptions(html)
                const routeRules: NitroRouteRules = defu({}, ..._routeRulesMatcher.matchAll(entry.route).reverse())
                Object.assign(entry, {
                  // @ts-expect-error runtime
                  path: extractedOptions.component ? `/api/og-image-html?path=${entry.route}` : entry.route,
                  ...extractedOptions,
                  ...(routeRules.ogImage || {}),
                })
              }
              // if we're rendering a component let's fetch the html, it will have everything we need
              if (entry.component)
                entry.html = await globalThis.$fetch(entry.path)
            }

            for (const k in screenshotQueue) {
              const entry = screenshotQueue[k]
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
          else {
            nitro.logger.log(chalk.red('Failed to create a browser to create og:images.'))
          }
        }
        catch (e) {
          console.error(e)
        }
        finally {
          await browser?.close()
          previewProcess.kill()
        }
        screenshotQueue = []
      }

      if (nuxt.options._generate) {
        // SSR mode
        nitro.hooks.hook('rollup:before', async () => {
          await captureScreenshots()
        })

        // SSG mode
        nitro.hooks.hook('close', async () => {
          await captureScreenshots()
        })
      }
    })
  },
})
