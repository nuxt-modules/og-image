export function extractOgImageOptions(html: string) {
  // extract the options from our script tag
  const options = html.match(/<script id="nuxt-og-image-options" type="application\/json">(.+?)<\/script>/)?.[1]
  return options ? JSON.parse(options) : false
}

export function stripOgImageOptions(html: string) {
  return html
    .replace(/<script id="nuxt-og-image-options" type="application\/json">(.*?)<\/script>/, '')
}
