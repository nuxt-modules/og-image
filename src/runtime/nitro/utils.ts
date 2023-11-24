import { existsSync, promises as fsp } from 'node:fs'
import { Buffer } from 'node:buffer'
import type { H3Event } from 'h3'
import { createError, getQuery } from 'h3'
import { join } from 'pathe'
import sizeOf from 'image-size'
import { createDefu } from 'defu'
import { withoutLeadingSlash } from 'ufo'
import { hash } from 'ohash'
import type { NuxtIslandResponse } from 'nuxt/dist/core/runtime/nitro/renderer'
import { createHeadCore } from '@unhead/vue'
import twemoji from 'twemoji'
import { renderSSRHead } from '@unhead/ssr'
import { useNitroCache } from '../cache'
import type { FontConfig, OgImageOptions, RuntimeOgImageOptions } from '../types'
import { extractAndNormaliseOgImageOptions } from './utils-pure'
import { useNitroOrigin, useRuntimeConfig } from '#imports'
import loadCSSInline from '#nuxt-og-image/css-inline'

export function wasmLoader(asyncModuleLoad: Promise<any> | Buffer | string, fallback: string) {
  let promise: Promise<any>
  let wasm: any
  return {
    async load(options: RuntimeOgImageOptions) {
      if (typeof promise !== 'undefined')
        return promise
      if (wasm)
        return wasm
      // eslint-disable-next-line no-async-promise-executor
      promise = promise || new Promise(async (resolve) => {
        try {
          wasm = await asyncModuleLoad
          if (typeof wasm === 'string')
            wasm = undefined
        }
        catch (e) {
        }
        if (!wasm) {
          wasm = await readPublicAsset(fallback, 'base64')
          if (wasm)
            wasm = Buffer.from(wasm, 'base64')
        }
        if (!wasm) {
          // fetch as base64
          wasm = await (await globalThis.$fetch(fallback, { baseURL: options.requestOrigin })).arrayBuffer()
          // read body as buffer
          wasm = Buffer.from(wasm)
        }
        resolve(wasm)
      })
      return promise
    },
  }
}

export async function fetchHTML(options: RuntimeOgImageOptions) {
  const { fonts, satoriOptions } = useRuntimeConfig()['nuxt-og-image']
  // const path = options.path
  // const scale = query.scale
  // const mode = query.mode || 'light'
  // extract the options from the original path

  // for screenshots just return the base path
  // if (options.provider === 'browser' && options.component === 'PageScreenshot') {
  //   // need the path without the base url, left trim the base url
  //   const pathWithoutBase = path.replace(new RegExp(`^${useRuntimeConfig().app.baseURL}`), '')
  //   return sendRedirect(e, withBase(pathWithoutBase, nitroOrigin))
  // }

  if (!options.component) {
    throw createError({
      statusCode: 500,
      statusMessage: `Nuxt OG Image trying to render an invalid component. Received options ${JSON.stringify(options)}`,
    })
  }

  // using Nuxt Island, generate the og:image HTML
  const hashId = hash([options.component, options])
  const island = await $fetch<NuxtIslandResponse>(`/__nuxt_island/${options.component}_${hashId}.json`, {
    params: {
      props: JSON.stringify(options),
    },
  })

  const head = createHeadCore()
  head.push(island.head)

  let defaultFontFamily = 'sans-serif'
  const firstFont = fonts[0] as FontConfig
  if (firstFont)
    defaultFontFamily = firstFont.name

  let html = island.html
  try {
    html = twemoji.parse(html!, {
      folder: 'svg',
      ext: '.svg',
    })
  }
  catch (e) {}

  // we need to group fonts by name
  const googleFonts: Record<string, FontConfig[]> = {}
  ;(fonts as FontConfig[])
    .filter(font => !font.path)
    .forEach((font) => {
      if (!googleFonts[font.name])
        googleFonts[font.name] = []
      googleFonts[font.name].push(font)
    })

  head.push({
    style: [
      {
        // default font is the first font family
        innerHTML: `body { font-family: \'${defaultFontFamily.replace('+', ' ')}\', sans-serif;  }`,
      },
      {
        innerHTML: `body {
    transform: scale(${options.scale || 1});
    transform-origin: top left;
    max-height: 100vh;
    position: relative;
    width: ${options.width}px;
    height: ${options.height}px;
    overflow: hidden;
    background-color: ${options.mode === 'dark' ? '#1b1b1b' : '#fff'};
}
img.emoji {
   height: 1em;
   width: 1em;
   margin: 0 .05em 0 .1em;
   vertical-align: -0.1em;
}`,
      },
      ...(fonts as FontConfig[])
        .filter(font => font.path)
        .map((font) => {
          return `
          @font-face {
            font-family: '${font.name}';
            font-style: normal;
            font-weight: ${font.weight};
            src: url('${font.path}') format('truetype');
          }
          `
        }),
    ],
    meta: [
      {
        charset: 'utf-8',
      },
    ],
    script: [
      {
        src: 'https://cdn.tailwindcss.com',
      },
      {
        innerHTML: `tailwind.config = {
  corePlugins: {
    preflight: false,
  },
  theme: ${JSON.stringify(satoriOptions?.tailwindConfig?.theme || {})}
}`,
      },
    ],
    link: [
      {
        // reset css to match svg output
        href: 'https://cdn.jsdelivr.net/npm/gardevoir',
        rel: 'stylesheet',
      },
      // have to add each weight as their own stylesheet
      ...Object.entries(googleFonts)
        .map(([name, fonts]) => {
          return {
            href: `https://fonts.googleapis.com/css2?family=${name}:wght@${fonts.map(f => f.weight).join(';')}&display=swap`,
            rel: 'stylesheet',
          }
        }),
    ],
  })

  // need to remove ALL script tags from the html
  html = html.replaceAll(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  const headChunk = await renderSSRHead(head)
  let htmlTemplate = `<!DOCTYPE html>
<html ${headChunk.htmlAttrs}>
<head>${headChunk.headTags}</head>
<body ${headChunk.bodyAttrs}>${headChunk.bodyTagsOpen}<div style="position: relative; display: flex; margin: 0 auto; width: ${options.width}px; height: ${options.height}px; overflow: hidden;">${html}</div>${headChunk.bodyTags}</body>
</html>`

  const cssInline = loadCSSInline()
  if (!cssInline.__mock) {
    let hasInlineStyles = false
    // for the tags we extract the stylesheet href and inline them where they are a vue template
    const stylesheets = htmlTemplate.match(/<link rel="stylesheet" href=".*?">/g)
    if (stylesheets) {
      for (const stylesheet of stylesheets) {
        // @todo we should check the actual component names
        if (!stylesheet.includes(`${options.component.replace('OgImageTemplate', '').replace('OgImage', '')}.vue`)) {
          htmlTemplate = htmlTemplate.replace(stylesheet, '')
        }
        else {
          // using regex
          const href = stylesheet.match(/href="(.*?)"/)![1]
          try {
            let css = (await (await $fetch(href, {
              baseURL: nitroOrigin,
            })).text())
            // css is in format of const __vite__css = "<css>"
            if (css.includes('const __vite__css =')) {
              // decode characters like \n
              css = css.match(/const __vite__css = "(.*)"/)![1].replace(/\\n/g, '\n')
            }
            css = css.replace(/\/\*# sourceMappingURL=.*?\*\//g, '')
              // need to replace all !important, they don't work in Satori
              .replaceAll('! important', '')
              .replaceAll('!important')
            // we remove the last line from the css //# sourceMappingURL=
            htmlTemplate = htmlTemplate.replace(stylesheet, `<style>${css}</style>`)
            hasInlineStyles = true
          }
          catch {
          }
        }
      }
    }
    if (hasInlineStyles) {
      try {
        htmlTemplate = await cssInline(htmlTemplate, {
          url: nitroOrigin,
        })
      }
      catch {
      }
    }
  }
  return htmlTemplate
}

export async function fetchOptionsCached(e: H3Event, path: string) {
  const key = [
    withoutLeadingSlash((path === '/' || !path) ? 'index' : path).replaceAll('/', '-'),
    'options',
  ].join(':')
  const { cachedItem, update } = await useNitroCache<RuntimeOgImageOptions>(e, 'nuxt-og-image', {
    key,
    // allow internal requests to be cached for 5 seconds
    cacheTtl: 5 * 1000,
    cache: !process.dev,
    headers: false,
  })
  if (cachedItem)
    return cachedItem as RuntimeOgImageOptions

  const options = await fetchOptions(e, path)
  if (options)
    await update(options)
  return options
}

export async function fetchOptions(e: H3Event, path: string): Promise<RuntimeOgImageOptions | false> {
  // extract the payload from the original path
  let html: string
  try {
    html = await globalThis.$fetch(path)
  }
  catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to read the path ${path} for og-image extraction. ${err.message}.`,
    })
  }

  e.node.req.url = path
  const oldRouteRules = e.context._nitro.routeRules
  e.context._nitro.routeRules = undefined
  const routeRules = (getRouteRules(e)?.ogImage || {}) as false | OgImageOptions
  e.context._nitro.routeRules = oldRouteRules
  e.node.req.url = e.path

  // has been disabled via route rules
  if (routeRules === false)
    return false

  const { defaults } = useRuntimeConfig()['nuxt-og-image']
  const payload = extractAndNormaliseOgImageOptions(path, html!, routeRules, defaults)
  // not supported
  if (!payload) {
    throw createError({
      statusCode: 500,
      statusMessage: `The path ${path} is missing the og-image payload.`,
    })
  }

  const merger = createDefu((object, key, value) => {
    // replace arrays instead of merging
    if (Array.isArray(value))
      return value
  })

  // need to hackily reset the event params so we can access the route rules of the base URL
  return merger(
    { requestOrigin: useNitroOrigin(e) },
    getQuery(e),
    payload,
  ) as RuntimeOgImageOptions
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Decode the base64 string into a binary string
  const buffer = Buffer.from(base64, 'base64')
  return new Uint8Array(buffer).buffer
}

function r(base: string, key: string) {
  return join(base!, key.replace(/:/g, '/'))
}

export async function readPublicAsset(file: string, encoding?: BufferEncoding) {
  const { assetDirs } = useRuntimeConfig()['nuxt-og-image']
  for (const assetDir of assetDirs) {
    const path = r(assetDir, file)
    if (existsSync(path))
      return await fsp.readFile(path, { encoding })
  }
}

export async function readPublicAssetBase64(file: string): Promise<{ src: string, width?: number, height?: number } | undefined> {
  // we want the data in Uint8Array format
  const base64 = (await readPublicAsset(file, 'base64')) as string
  if (base64) {
    const dimensions = await sizeOf(Buffer.from(base64, 'base64'))
    return {
      src: toBase64Image(file, base64),
      ...dimensions,
    }
  }
}

export function toBase64Image(fileName: string, data: string | ArrayBuffer) {
  const base64 = typeof data === 'string' ? data : Buffer.from(data).toString('base64')
  let type = 'image/jpeg'
  // guess type from file name
  const ext = fileName.split('.').pop()
  if (ext === 'svg')
    type = 'image/svg+xml'
  else if (ext === 'png')
    type = 'image/png'
  return `data:${type};base64,${base64}`
}

export * from './utils-pure'
