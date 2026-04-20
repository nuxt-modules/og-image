import type { Resolver } from '@nuxt/kit'
import type { Nitro } from 'nitropack/types'
import type { Nuxt } from 'nuxt/schema'
import type { ModuleOptions } from '../module'
import type { ClientFunctions, CreateComponentOptions, ServerFunctions } from '../rpc-types'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { updateTemplates, useNuxt } from '@nuxt/kit'
import { setupDevToolsUI as _setupDevToolsUI, setupDevToolsRpc } from 'nuxtseo-shared/devtools'
import { isAbsolute, join, relative, resolve as resolvePath } from 'pathe'
import { RE_RENDERER_SUFFIX } from '../util'

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
  _setupDevToolsUI({
    route: '/__nuxt-og-image',
    name: 'nuxt-og-image',
    title: 'OG Image',
    icon: 'carbon:image-search',
  }, resolve, nuxt)

  const communityTemplatesDir = resolve('./runtime/app/components/Templates/Community')

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

  setupDevToolsRpc<ServerFunctions, ClientFunctions>('nuxt-og-image', {
    async ejectCommunityTemplate(path: string) {
      const [dirName, componentName] = path.split('/')
      const nameWithoutExt = componentName?.replace('.vue', '') || ''
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
      const validRenderers = ['satori', 'browser', 'takumi']
      if (!validRenderers.includes(renderer))
        throw new Error(`Invalid renderer: ${renderer}`)
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
  } as ServerFunctions, nuxt).then((rpc) => {
    const safeBroadcast = (fn: () => unknown) => {
      try {
        const result = fn()
        if (result && typeof (result as Promise<unknown>).then === 'function')
          (result as Promise<unknown>).catch(() => {})
      }
      catch {}
    }
    let cssRefreshTimer: ReturnType<typeof setTimeout> | undefined
    nuxt.hook('builder:watch', (e, watchPath) => {
      if (!e || !watchPath)
        return
      const normalizedPath = relative(nuxt.options.srcDir, isAbsolute(watchPath) ? watchPath : resolvePath(nuxt.options.srcDir, watchPath))
      const absolutePath = isAbsolute(watchPath) ? watchPath : join(nuxt.options.rootDir, watchPath)

      const isCssChange = absolutePath.endsWith('.css') && nuxt.options.css.some((entry) => {
        const src = typeof entry === 'string' ? entry : (entry as any)?.src
        return src && absolutePath.endsWith(src.replace(RE_TILDE_SLASH, ''))
      })
      if (isCssChange || normalizedPath.includes('uno.config')) {
        clearTimeout(cssRefreshTimer)
        cssRefreshTimer = setTimeout(() => {
          safeBroadcast(() => rpc.broadcast.refresh())
        }, 200)
        return
      }

      if ((e === 'change' || e.includes('link')) && (normalizedPath.startsWith('pages') || normalizedPath.startsWith('content'))) {
        safeBroadcast(() => rpc.broadcast.refreshRouteData(normalizedPath))
      }
      if (options.componentDirs.some(dir => normalizedPath.includes(dir))) {
        if (e === 'change')
          safeBroadcast(() => rpc.broadcast.refresh())
        else
          safeBroadcast(() => rpc.broadcast.refreshGlobalData())
      }
    })
  })
}
