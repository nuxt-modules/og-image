import { addTemplate, useNuxt } from '@nuxt/kit'

export function exposeConfig(alias: string, filename: string, config: any) {
  const exports = Object.entries(config).map(([k, v]) => `export const ${k} = '${v}'`).join('\n')
  useNuxt().options.alias[alias] = addTemplate({
    filename,
    getContents: () => exports,
  }).dst
  // expose for nitro as well
  useNuxt().hooks.hook('nitro:config', (nitroConfig) => {
    nitroConfig.virtual![alias] = exports
  })
}
