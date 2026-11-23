import { defineEventHandler } from 'nuxt/server'

// Exercises the auto-imported Nitro utility from a pure server handler (#690).
export default defineEventHandler((event) => {
  const options = { component: 'NuxtSeo.satori', props: { title: 'From Nitro' } }
  return {
    url: getOgImageUrl(event, '/satori', options),
    punctuated: getOgImageUrl(event, '/satori', {
      ...options,
      props: { title: 'From Nitro\'s renderer', description: 'One+two, three', label: '%27' },
    }),
    escapedPropNames: getOgImageUrl(event, '/satori', {
      ...options,
      props: { ...options.props, 'label%27': 'Literal escape', 'label\'': 'Apostrophe' },
    }),
    // no page path: falls back to the request path
    current: getOgImageUrl(event, options),
  }
})
