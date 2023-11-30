import { parseURL, withoutBase, withoutLeadingSlash, withoutTrailingSlash } from 'ufo'
import type { H3Error, H3Event } from 'h3'
import { createError, getQuery } from 'h3'
import { defu } from 'defu'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import type { NitroRouteRules } from 'nitropack'
import type { OgImageOptions, Renderer, RuntimeOgImageOptions } from '../../types'
import { fetchPathHtmlAndExtractOptions } from '../options/fetch'
import { prerenderCache } from '../cache/prerender'
import type SatoriRenderer from '../renderers/satori'
import type ChromiumRenderer from '../renderers/chromium'
import { useRuntimeConfig } from '#imports'

type MaybePromise<T> = T | Promise<T>

const satoriRendererInstance: { instance?: MaybePromise<typeof SatoriRenderer> } = { instance: undefined }
const chromiumRendererInstance: { instance?: MaybePromise<typeof ChromiumRenderer> } = { instance: undefined }

export async function resolveRendererContext(e: H3Event): Promise<H3Error | { extension: RuntimeOgImageOptions['extension'], renderer: Renderer, options: RuntimeOgImageOptions }> {
  const runtimeConfig = useRuntimeConfig()['nuxt-og-image']
  const path = parseURL(e.path).pathname

  const extension = path.split('.').pop()
  if (!extension) {
    return createError({
      statusCode: 400,
      statusMessage: `Missing OG Image type.`,
    })
  }
  const basePath = withoutTrailingSlash(path
    .replace('/__og-image__/image', '')
    .replace(`/og.${extension}`, ''),
  )
  const queryParams = { ...getQuery(e) }
  let options = queryParams.options as OgImageOptions
  if (!options) {
    if (import.meta.prerender) {
      const key = [
        withoutLeadingSlash((basePath === '/' || !basePath) ? 'index' : basePath).replaceAll('/', '-'),
      ].join(':')
      options = await prerenderCache?.getItem(key)
    }
    else {
      options = await fetchPathHtmlAndExtractOptions(e, basePath)
      if (options instanceof Error)
        return options
    }
  }
  // no matter how we get the options, apply the defaults and the normalisation
  delete queryParams.options
  const _routeRulesMatcher = toRouteMatcher(
    createRadixRouter({ routes: useRuntimeConfig().nitro?.routeRules }),
  )
  const routeRules = defu({}, ..._routeRulesMatcher.matchAll(
    withoutBase(basePath.split('?')[0], useRuntimeConfig().app.baseURL),
  ).reverse()).ogImage as NitroRouteRules['ogImage']
  options = defu(queryParams, routeRules, options, runtimeConfig.defaults) as OgImageOptions
  if (!options) {
    return createError({
      statusCode: 404,
      statusMessage: 'OG Image not found.',
    })
  }
  let renderer: MaybePromise<typeof SatoriRenderer | typeof ChromiumRenderer> | undefined
  // TODO check we can't use dynamic imports
  switch (options.renderer) {
    case 'satori':
      renderer = satoriRendererInstance.instance = satoriRendererInstance.instance
      || await import('#nuxt-og-image/renderers/satori')
        .then(m => Object.keys(m.default).length ? m.default : false)
      break
    case 'chromium':
      renderer = chromiumRendererInstance.instance = chromiumRendererInstance.instance
      || await import('#nuxt-og-image/renderers/chromium')
        .then(m => Object.keys(m.default).length ? m.default : false)
      break
  }
  if (!renderer) {
    throw createError({
      statusCode: 400,
      statusMessage: `Renderer ${options.renderer} is missing.`,
    })
  }
  return {
    renderer,
    extension,
    options: <RuntimeOgImageOptions> {
      ...options,
      extension: extension === 'json' ? options.extension : extension,
      path: basePath,
    },
  }
}
