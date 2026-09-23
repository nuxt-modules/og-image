// Exercises the auto-imported Nitro utilities from a pure server handler (#690).
export default defineEventHandler((event) => {
  const options = { component: 'NuxtSeo.satori', props: { title: 'From Nitro' } }
  return {
    relative: getOgImageUrl('/satori', options),
    absolute: getOgImageUrl('/satori', options, event),
    path: getOgImagePath('/satori', options).path,
  }
})
