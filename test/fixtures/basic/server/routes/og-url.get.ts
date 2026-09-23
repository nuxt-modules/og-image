// Exercises the auto-imported Nitro utility from a pure server handler (#690).
export default defineEventHandler(event => ({
  url: getOgImageUrl(event, '/satori', { component: 'NuxtSeo.satori', props: { title: 'From Nitro' } }),
}))
