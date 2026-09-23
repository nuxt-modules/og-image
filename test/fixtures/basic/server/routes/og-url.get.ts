// Exercises the auto-imported Nitro utility from a pure server handler (#690).
export default defineEventHandler((event) => {
  const options = { component: 'NuxtSeo.satori', props: { title: 'From Nitro' } }
  return {
    url: getOgImageUrl(event, '/satori', options),
    // no page path: falls back to the request path
    current: getOgImageUrl(event, options),
  }
})
