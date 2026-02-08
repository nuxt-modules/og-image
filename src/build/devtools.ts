import type { Resolver } from '@nuxt/kit'
import type { Nitro } from 'nitropack/types'
import type { Nuxt } from 'nuxt/schema'
import type { ModuleOptions } from '../module'
import type { ClientFunctions, ServerFunctions } from '../rpc-types'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { addCustomTab, extendServerRpc, onDevToolsInitialized } from '@nuxt/devtools-kit'
import { updateTemplates, useNuxt } from '@nuxt/kit'
import { isAbsolute, join, relative, resolve as resolvePath } from 'pathe'

const DEVTOOLS_UI_ROUTE = '/__nuxt-og-image'
const DEVTOOLS_UI_LOCAL_PORT = 3030

export function setupDevToolsUI(options: ModuleOptions, resolve: Resolver['resolve'], nuxt: Nuxt = useNuxt()) {
  const clientPath = resolve('./client')
  const communityTemplatesDir = resolve('./runtime/app/components/Templates/Community')
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
      if (!config.server) {
        (config as any).server = {}
      }
      (config.server as any).proxy ||= {}
      config.server!.proxy![DEVTOOLS_UI_ROUTE] = {
        target: `http://localhost:${DEVTOOLS_UI_LOCAL_PORT}${DEVTOOLS_UI_ROUTE}`,
        changeOrigin: true,
        followRedirects: true,
        rewrite: path => path.replace(DEVTOOLS_UI_ROUTE, ''),
      }
    })
  }

  const useNitro = new Promise<Nitro>((resolve) => {
    nuxt.hooks.hook('nitro:init', resolve)
  })

  // wait for DevTools to be initialized
  onDevToolsInitialized(async () => {
    const rpc = extendServerRpc<ClientFunctions, ServerFunctions>('nuxt-og-image', {
      async ejectCommunityTemplate(path: string) {
        const [dirName, componentName] = path.split('/')
        const nameWithoutExt = componentName?.replace('.vue', '') || ''
        // Handle both dot-notation (NuxtSeo.takumi) and PascalCase (NuxtSeoTakumi)
        let dotNotationName: string
        if (nameWithoutExt.includes('.')) {
          dotNotationName = `${nameWithoutExt}.vue`
        }
        else {
          const rendererMatch = nameWithoutExt.match(/(Satori|Browser|Takumi)$/)
          const renderer = rendererMatch?.[1]?.toLowerCase() || 'satori'
          const baseName = nameWithoutExt.replace(/(Satori|Browser|Takumi)$/, '')
          dotNotationName = `${baseName}.${renderer}.vue`
        }
        const dir = join(nuxt.options.srcDir, 'components', dirName || '')
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true })
        }
        const newPath = join(dir, dotNotationName)
        const templatePath = join(communityTemplatesDir, dotNotationName)
        const template = (await readFile(templatePath, 'utf-8')).replace('{{ title }}', `{{ title }} - Ejected!`)
        await writeFile(newPath, template, { encoding: 'utf-8' })
        await updateTemplates({ filter: t => t.filename.includes('nuxt-og-image/components.mjs') })
        const nitro = await useNitro
        await nitro.hooks.callHook('rollup:reload')
        return newPath
      },
    })

    nuxt.hook('builder:watch', (e, watchPath) => {
      if (!e || !watchPath)
        return
      // Use pathe's resolve (not the module resolver) to normalize the path
      const normalizedPath = relative(nuxt.options.srcDir, isAbsolute(watchPath) ? watchPath : resolvePath(nuxt.options.srcDir, watchPath))
      // needs to be for a page change
      if ((e === 'change' || e.includes('link')) && (normalizedPath.startsWith('pages') || normalizedPath.startsWith('content'))) {
        rpc.broadcast.refreshRouteData(normalizedPath) // client needs to figure it if it's for the page we're on
          .catch(() => {}) // ignore errors
      }
      if (options.componentDirs.some(dir => normalizedPath.includes(dir))) {
        if (e === 'change') {
          rpc.broadcast.refresh()
            .catch(() => {})
        }
        else {
          rpc.broadcast.refreshGlobalData().catch(() => {})
        }
      }
    })
    // call client RPC functions
    // since it might have multiple clients connected, we use `broadcast` to call all of them
  })

  addCustomTab({
    name: 'nuxt-og-image',
    title: 'OG Image',
    icon: 'carbon:image-search',
    view: {
      type: 'iframe',
      src: DEVTOOLS_UI_ROUTE,
    },
  })
}
