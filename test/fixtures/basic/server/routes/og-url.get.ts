// Exercises the auto-imported Nitro utilities from a pure server handler (#690).
export default defineEventHandler((event) => {
  const options = { component: 'NuxtSeo.satori', props: { title: 'From Nitro' } }
  return {
    url: getOgImageUrl(event, '/satori', options),
    path: getOgImagePath(event, '/satori', options).path,
  }
})
