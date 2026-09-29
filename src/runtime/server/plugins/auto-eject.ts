import type { Hookable } from 'hookable'
import type { OgImageComponent, OgImageOptionsInternal } from '../../types'
import { parse } from 'devalue'
import { defineNitroPlugin } from '#nuxtseo/nitro'
import { autoEjectCommunityTemplate } from '../util/auto-eject'
import { normaliseOptions } from '../util/options'
import { useOgImageRuntimeConfig } from '../utils'

const PAYLOAD_REGEX = /<script.+id="nuxt-og-image-options"[^>]*>(.+?)<\/script>/

// Dev only: when a rendered page asks for a community template, copy it into the app.
// Image requests do not trigger this, so DevTools template previews never write files.
// The copy waits for the response: a new components directory restarts the dev server.
// @ts-expect-error hookable v6
export default defineNitroPlugin((nitro: { hooks: Hookable<any> }) => {
  if (!import.meta.dev)
    return

  nitro.hooks.hook('render:html', (html: { head: string[], bodyAppend: string[] }, ctx: { event: any }) => {
    const payload = [...html.head, ...html.bodyAppend].join('\n').match(PAYLOAD_REGEX)?.[1]
    if (!payload)
      return
    for (const options of parse(payload) as OgImageOptionsInternal[]) {
      // Without an explicit component the page uses the default app template.
      if (!options?.component)
        continue
      const normalised = (() => {
        try {
          return normaliseOptions({ ...options })
        }
        catch {
          // An unknown component name is reported by the image route. Nothing to eject.
          return null
        }
      })()
      if (normalised?.component?.category === 'community')
        (ctx.event.context._ogImageAutoEject ||= []).push(normalised.component)
    }
  })

  nitro.hooks.hook('afterResponse', (event: any) => {
    const components: OgImageComponent[] | undefined = event.context._ogImageAutoEject
    if (!components?.length)
      return
    const runtimeConfig = useOgImageRuntimeConfig(event)
    for (const component of components)
      autoEjectCommunityTemplate(component, runtimeConfig)
  })
})
