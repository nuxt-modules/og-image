import { addTemplate, useNuxt } from '@nuxt/kit'

export function exposeConfig(alias: string, filename: string, config: any) {
  const exports = Object.entries(config).map(([k, v]) => `export const ${k} = ${JSON.stringify(v)}`).join('\n')
  useNuxt().options.alias[alias] = addTemplate({
    filename,
    getContents: () => exports,
  }).dst
  // expose for nitro as well
  useNuxt().hooks.hook('nitro:config', (nitroConfig) => {
    nitroConfig.virtual![alias] = exports
  })
}

export function extractOgImageOptions(html: string) {
  // extract the options from our script tag
  const options = html.match(/<script id="nuxt-og-image-options" type="application\/json">(.+?)<\/script>/)?.[1]
  if (options) {
    // convert html encoded characters to utf8
    return JSON.parse(options)
  }
  return false
}

export function stripOgImageOptions(html: string) {
  return html
    .replace(/<script id="nuxt-og-image-options" type="application\/json">(.*?)<\/script>/, '')
}
