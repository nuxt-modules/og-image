import type { Resolver } from '@nuxt/kit'
import type { Nitro } from 'nitropack/types'
import type { Nuxt } from 'nuxt/schema'
import type { ModuleOptions } from '../module'
import type { ClientFunctions, CreateComponentOptions, ServerFunctions } from '../rpc-types'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { addCustomTab, extendServerRpc, onDevToolsInitialized } from '@nuxt/devtools-kit'
import { updateTemplates, useNuxt } from '@nuxt/kit'
import { isAbsolute, join, relative, resolve as resolvePath } from 'pathe'
import { RE_RENDERER_SUFFIX } from '../util'

const DEVTOOLS_UI_ROUTE = '/__nuxt-og-image'
const DEVTOOLS_UI_LOCAL_PORT = 3030

const RE_TILDE_SLASH = /^~\//
const RE_WORD_CHARS_ONLY = /^\w+$/
const RE_SCRIPT_SETUP = /<script\s+setup[^>]*>\n?/

const SCRIPT_BLOCK = `<script setup lang="ts">
const { title = 'My Page', description = '' } = defineProps<{
  title?: string
  description?: string
}>()
</script>`

function getStarterTemplate(renderer: string, css: string): string {
  if (renderer === 'satori') {
    return `${SCRIPT_BLOCK}

<template>
  <div :style="{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', padding: '60px', backgroundColor: 'white', color: '#171717' }">
    <h1 :style="{ fontSize: '72px', fontWeight: 'bold', margin: 0, lineHeight: 1.1, textAlign: 'center' }">
      {{ title }}
    </h1>
    <p v-if="description" :style="{ fontSize: '32px', opacity: 0.6, marginTop: '16px', textAlign: 'center', maxWidth: '900px' }">
      {{ description }}
    </p>
  </div>
</template>
`
  }

  if (css === 'tailwind' || css === 'unocss') {
    return `${SCRIPT_BLOCK}

<template>
  <div class="w-full h-full flex flex-col justify-center items-center p-[60px] bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white">
    <h1 class="text-[72px] font-bold m-0 leading-tight text-center" style="text-wrap: balance;">
      {{ title }}
    </h1>
    <p v-if="description" class="text-[32px] opacity-60 mt-4 text-center max-w-[900px]">
      {{ description }}
    </p>
  </div>
</template>
`
  }

  return `${SCRIPT_BLOCK}

<template>
  <div class="container">
    <h1>{{ title }}</h1>
    <p v-if="description">
      {{ description }}
    </p>
  </div>
</template>

<style scoped>
.container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 60px;
  background: white;
  color: #171717;
}
h1 {
  font-size: 72px;
  font-weight: bold;
  margin: 0;
  line-height: 1.1;
  text-align: center;
  text-wrap: balance;
}
p {
  font-size: 32px;
  opacity: 0.6;
  margin-top: 16px;
  text-align: center;
  max-width: 900px;
}
</style>
`
}

export function setupDevToolsUI(options: ModuleOptions, resolve: Resolver['resolve'], nuxt: Nuxt = useNuxt(), cssFramework: string = 'none') {
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

  async function insertDefineOgImage(componentName: string, pageFile: string): Promise<boolean> {
    const resolved = pageFile ? resolvePath(pageFile) : ''
    if (!resolved || !resolved.startsWith(nuxt.options.srcDir) || !existsSync(resolved))
      return false
    const content = await readFile(resolved, 'utf-8')
    if (content.includes('defineOgImage'))
      return false
    const call = `defineOgImage('${componentName}')`
    const scriptSetupMatch = content.match(RE_SCRIPT_SETUP)
    if (scriptSetupMatch) {
      const insertPos = scriptSetupMatch.index! + scriptSetupMatch[0].length
      await writeFile(resolved, `${content.slice(0, insertPos)}${call}\n${content.slice(insertPos)}`, 'utf-8')
    }
    else {
      await writeFile(resolved, `<script setup lang="ts">\n${call}\n</script>\n\n${content}`, 'utf-8')
    }
    return true
  }

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
          const rendererMatch = nameWithoutExt.match(RE_RENDERER_SUFFIX)
          const renderer = rendererMatch?.[1]?.toLowerCase() || 'satori'
          const baseName = nameWithoutExt.replace(RE_RENDERER_SUFFIX, '')
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
      async createComponent({ name, renderer, pageFile }: CreateComponentOptions) {
        // Validate renderer
        const validRenderers = ['satori', 'browser', 'takumi']
        if (!validRenderers.includes(renderer))
          throw new Error(`Invalid renderer: ${renderer}`)

        // Validate component name: PascalCase identifier only, no path separators or special chars
        if (!RE_WORD_CHARS_ONLY.test(name))
          throw new Error(`Invalid component name: ${name}`)

        const baseDir = existsSync(join(nuxt.options.srcDir, 'app'))
          ? join(nuxt.options.srcDir, 'app')
          : nuxt.options.srcDir
        const outputDir = join(baseDir, 'components', 'OgImage')
        if (!existsSync(outputDir))
          mkdirSync(outputDir, { recursive: true })

        const filename = `${name}.${renderer}.vue`
        const outputPath = join(outputDir, filename)
        if (existsSync(outputPath))
          throw new Error(`File already exists: ${relative(nuxt.options.rootDir, outputPath)}`)

        const template = getStarterTemplate(renderer, cssFramework)
        await writeFile(outputPath, template, { encoding: 'utf-8' })

        await insertDefineOgImage(name, pageFile)

        await updateTemplates({ filter: t => t.filename.includes('nuxt-og-image/components.mjs') })
        const nitro = await useNitro
        await nitro.hooks.callHook('rollup:reload')
        return outputPath
      },
      async addOgImageToPage(componentName: string, pageFile: string) {
        if (!RE_WORD_CHARS_ONLY.test(componentName))
          throw new Error(`Invalid component name: ${componentName}`)
        return insertDefineOgImage(componentName, pageFile)
      },
    })

    let cssRefreshTimer: ReturnType<typeof setTimeout> | undefined
    nuxt.hook('builder:watch', (e, watchPath) => {
      if (!e || !watchPath)
        return
      // Use pathe's resolve (not the module resolver) to normalize the path
      const normalizedPath = relative(nuxt.options.srcDir, isAbsolute(watchPath) ? watchPath : resolvePath(nuxt.options.srcDir, watchPath))
      const absolutePath = isAbsolute(watchPath) ? watchPath : join(nuxt.options.rootDir, watchPath)

      // CSS file or framework config change → debounced refresh so devtools re-renders with fresh styles
      const isCssChange = absolutePath.endsWith('.css') && nuxt.options.css.some((entry) => {
        const src = typeof entry === 'string' ? entry : (entry as any)?.src
        return src && absolutePath.endsWith(src.replace(RE_TILDE_SLASH, ''))
      })
      if (isCssChange || normalizedPath.includes('uno.config')) {
        clearTimeout(cssRefreshTimer)
        cssRefreshTimer = setTimeout(() => {
          rpc.broadcast.refresh().catch(() => {})
        }, 200)
        return
      }

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
