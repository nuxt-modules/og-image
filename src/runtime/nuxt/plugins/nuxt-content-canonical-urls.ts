import { parseURL } from 'ufo'
import type { HeadPlugin } from '@unhead/schema'
import { toValue } from 'vue'
import { isInternalRoute } from '../../utilts'
import { useRequestEvent, withSiteUrl } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  // specifically we're checking if a route is missing a payload but has route rules, we can inject the meta needed
  nuxtApp.hooks.hook('app:rendered', async (ctx) => {
    const { ssrContext } = ctx
    const e = useRequestEvent()
    const path = parseURL(e.path).pathname
    if (isInternalRoute(path))
      return

    // unhead plugin to correct missing site URL, this is to fix the Nuxt Content integration not being able to resolve the correct URL
    ssrContext?.head.use(<HeadPlugin>{
      key: 'nuxt-og-image:canonical-urls',
      hooks: {
        'tags:resolve': async ({ tags }) => {
          for (const tag of tags) {
            if (tag.tag === 'meta' && (tag.props.property === 'og:image' || tag.props.name === 'twitter:image:src')) {
              // looking for:
              // property og:image
              // property twitter:image:src
              if (!tag.props.content.startsWith('https')) {
                await nuxtApp.runWithContext(() => {
                  tag.props.content = toValue(withSiteUrl(tag.props.content))
                })
              }
            }
          }
        },
      },
    })
  })
})
