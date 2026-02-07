import type { Resolver } from '@nuxt/kit'
import type { Nitro } from 'nitropack/types'
import type { Nuxt } from 'nuxt/schema'
import type { ViteDevServer } from 'vite'
import type { ModuleOptions } from '../module'
import type { ClientFunctions, ServerFunctions } from '../rpc-types'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { addCustomTab, extendServerRpc, onDevToolsInitialized } from '@nuxt/devtools-kit'
import { updateTemplates, useNuxt } from '@nuxt/kit'
import { isAbsolute, relative, resolve as resolvePath } from 'pathe'

const DEVTOOLS_UI_ROUTE = '/__nuxt-og-image'
const DEVTOOLS_UI_LOCAL_PORT = 3030

function isOgImagePath(path: string, componentDirs: string[]) {
  return componentDirs.some(dir => path.includes(dir))
}

export function setupDevToolsUI(options: ModuleOptions, resolve: Resolver['resolve'], nuxt: Nuxt = useNuxt()) {
  const clientPath = resolve('./client')
  const isProductionBuild = existsSync(clientPath)

  let viteServer: ViteDevServer | undefined

  // Serve production-built client (used when package is published)
  if (isProductionBuild) {
    nuxt.hook('vite:serverCreated', async (server) => {
      viteServer = server
      const sirv = await import('sirv').then(r => r.default || r)
      server.middlewares.use(
        DEVTOOLS_UI_ROUTE,
        sirv(clientPath, { dev: true, single: true }),
      )
    })
  }
  // In local development, start a separate Nuxt Server and proxy to serve the client
  else {
    nuxt.hook('vite:serverCreated', (server) => {
      viteServer = server
    })
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

  // HMR via Vite custom events — works regardless of DevTools RPC connection state
  nuxt.hook('builder:watch', (e, watchPath) => {
    const normalizedPath = relative(nuxt.options.srcDir, isAbsolute(watchPath) ? watchPath : resolvePath(nuxt.options.srcDir, watchPath))
    if (!isOgImagePath(normalizedPath, options.componentDirs))
      return
    if (e === 'change') {
      viteServer?.ws.send({ type: 'custom', event: 'nuxt-og-image:refresh' })
    }
    else {
      viteServer?.ws.send({ type: 'custom', event: 'nuxt-og-image:refresh-global' })
    }
  })

  const useNitro = new Promise<Nitro>((resolve) => {
    nuxt.hooks.hook('nitro:init', resolve)
  })

  // DevTools RPC — kept as secondary notification path
  onDevToolsInitialized(async () => {
    const rpc = extendServerRpc<ClientFunctions, ServerFunctions>('nuxt-og-image', {
      async ejectCommunityTemplate(path: string) {
        const [dirName, componentName] = path.split('/')
        const dir = resolve(nuxt.options.srcDir, 'components', dirName || '')
        if (!existsSync(dir)) {
          mkdirSync(dir)
        }
        const newPath = resolve(dir, componentName || '')
        const templatePath = resolve(`./runtime/app/components/Templates/Community/${componentName}`)
        // readFile, we need to modify it
        const template = (await readFile(templatePath, 'utf-8')).replace('{{ title }}', `{{ title }} - Ejected!`)
        // copy the file over
        await writeFile(newPath, template, { encoding: 'utf-8' })
        await updateTemplates({ filter: t => t.filename.includes('nuxt-og-image/components.mjs') })
        const nitro = await useNitro
        await nitro.hooks.callHook('rollup:reload')
        return newPath
      },
    })

    nuxt.hook('builder:watch', (e, watchPath) => {
      const normalizedPath = relative(nuxt.options.srcDir, isAbsolute(watchPath) ? watchPath : resolvePath(nuxt.options.srcDir, watchPath))
      if ((e === 'change' || e.includes('link')) && (normalizedPath.startsWith('pages') || normalizedPath.startsWith('content'))) {
        rpc.broadcast.refreshRouteData(normalizedPath)
          .catch(() => {})
      }
      if (isOgImagePath(normalizedPath, options.componentDirs)) {
        if (e === 'change') {
          rpc.broadcast.refresh()
            .catch(() => {})
        }
        else {
          rpc.broadcast.refreshGlobalData().catch(() => {})
        }
      }
    })
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
