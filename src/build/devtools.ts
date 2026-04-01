import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from 'nuxt/schema'
import type { ModuleOptions } from '../module'
import type { ClientFunctions, ServerFunctions } from '../rpc-types'
import { existsSync } from 'node:fs'
import { relative } from 'node:path'
import { extendServerRpc, onDevToolsInitialized } from '@nuxt/devtools-kit'
import { useNuxt } from '@nuxt/kit'

const DEVTOOLS_UI_ROUTE = '/__nuxt-og-image'
const DEVTOOLS_UI_LOCAL_PORT = 3030

export function setupDevToolsUI(options: ModuleOptions, resolve: Resolver['resolve'], nuxt: Nuxt = useNuxt()) {
  const clientPath = resolve('./client')
  const isProductionBuild = existsSync(clientPath)

  // Serve production-built client (used when package is published)
  if (isProductionBuild) {
    nuxt.hook('vite:serverCreated', async (server) => {
      const sirv = await import('sirv').then(r => r.default || r)
      server.middlewares.use(
        DEVTOOLS_UI_ROUTE,
        sirv(clientPath, { dev: true, single: true }),
      )
    })
  }
  // In local development, start a separate Nuxt Server and proxy to serve the client
  else {
    nuxt.hook('vite:extendConfig', (config) => {
      config.server = config.server || {}
      config.server.proxy = config.server.proxy || {}
      config.server.proxy[DEVTOOLS_UI_ROUTE] = {
        target: `http://localhost:${DEVTOOLS_UI_LOCAL_PORT}${DEVTOOLS_UI_ROUTE}`,
        changeOrigin: true,
        followRedirects: true,
        rewrite: path => path.replace(DEVTOOLS_UI_ROUTE, ''),
      }
    })
  }

  // wait for DevTools to be initialized
  onDevToolsInitialized(async () => {
    let rpc: ReturnType<typeof extendServerRpc<ClientFunctions, ServerFunctions>> | undefined
    try {
      rpc = extendServerRpc<ClientFunctions, ServerFunctions>('nuxt-og-image', {})
    }
    catch (err) {
      console.warn('[nuxt-og-image] Failed to set up DevTools RPC - live refresh will not work. If you\'re using @nuxt/devtools >= 4.0, this version of nuxt-og-image may not be compatible yet.', err)
      return
    }
    if (!rpc?.broadcast) {
      console.warn('[nuxt-og-image] DevTools RPC connected but `broadcast` is unavailable - live refresh will not work. If you\'re using @nuxt/devtools >= 4.0, this version of nuxt-og-image may not be compatible yet.')
      return
    }

    nuxt.hook('builder:watch', (e, path) => {
      path = relative(nuxt.options.srcDir, resolve(nuxt.options.srcDir, path))
      // needs to be for a page change
      if ((e === 'change' || e.includes('link')) && (path.startsWith('pages') || path.startsWith('content'))) {
        rpc!.broadcast.refreshRouteData(path) // client needs to figure it if it's for the page we're on
          ?.catch(() => {}) // ignore errors
      }
      if (options.componentDirs.some(dir => path.includes(dir))) {
        if (e === 'change') {
          rpc!.broadcast.refresh()
            ?.catch(() => {})
        }
        else {
          rpc!.broadcast.refreshGlobalData()?.catch(() => {})
        }
      }
    })
    // call client RPC functions
    // since it might have multiple clients connected, we use `broadcast` to call all of them
  })

  nuxt.hook('devtools:customTabs', (tabs) => {
    tabs.push({
      // unique identifier
      name: 'nuxt-og-image',
      // title to display in the tab
      title: 'OG Image',
      // any icon from Iconify, or a URL to an image
      icon: 'carbon:image-search',
      // iframe view
      view: {
        type: 'iframe',
        src: DEVTOOLS_UI_ROUTE,
      },
    })
  })
}
