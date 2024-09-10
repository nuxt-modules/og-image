import { defineNuxtPlugin, useRequestEvent, withSiteUrl } from '#imports'
import { defu } from 'defu'
import { parse, stringify } from 'devalue'
import { parseURL } from 'ufo'
import { toValue } from 'vue'
import type { HeadPlugin } from '@unhead/schema'
import { isInternalRoute, separateProps } from '../../pure'
import type { OgImageOptions } from '../../types'

export default defineNuxtPlugin({
  setup(nuxtApp) {
    // specifically we're checking if a route is missing a payload but has route rules, we can inject the meta needed
    nuxtApp.hooks.hook('app:rendered', async (ctx) => {
      const { ssrContext } = ctx
      const e = useRequestEvent()
      const path = parseURL(e.path).pathname
      if (isInternalRoute(path))
        return

      // unhead plugin to correct missing site URL, this is to fix the Nuxt Content integration not being able to resolve the correct URL
      ssrContext?.head.use(<HeadPlugin>{
        key: 'nuxt-og-image:overrides-and-canonical-urls',
        hooks: {
          'tags:resolve': async (ctx) => {
            // check if script id 'nuxt-og-image-options' exists
            const hasPrimaryPayload = ctx.tags.some(tag => tag.tag === 'script' && tag.props.id === 'nuxt-og-image-options')
            // see if id "nuxt-og-image-overrides" exists
            let overrides: OgImageOptions | undefined
            for (const tag of ctx.tags) {
              if (tag.tag === 'script' && tag.props.id === 'nuxt-og-image-overrides') {
                if (hasPrimaryPayload) {
                  overrides = separateProps(parse(tag.innerHTML || '{}'))
                  delete ctx.tags[ctx.tags.indexOf(tag)]
                }
                else {
                  // make this the primary payload
                  tag.props.id = 'nuxt-og-image-options'
                  tag.innerHTML = stringify(separateProps(parse(tag.innerHTML || '{}')))
                  tag._d = 'script:id:nuxt-og-image-options'
                }
                break
              }
            }
            ctx.tags = ctx.tags.filter(Boolean)

            for (const tag of ctx.tags) {
              if (tag.tag === 'meta' && (tag.props.property === 'og:image' || ['twitter:image:src', 'twitter:image'].includes(tag.props.name))) {
                // looking for:
                // property og:image
                // property twitter:image:src
                if (!tag.props.content.startsWith('https')) {
                  await nuxtApp.runWithContext(() => {
                    tag.props.content = toValue(withSiteUrl(tag.props.content, {
                      withBase: true,
                    }))
                  })
                }
              }
              // need to insert the overrides into the payload
              else if (overrides && tag.tag === 'script' && tag.props.id === 'nuxt-og-image-options') {
                tag.innerHTML = stringify(defu(overrides, parse(tag.innerHTML)))
              }
            }
          },
        },
      })
    })
  },
})
