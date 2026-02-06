import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  rollup: {
    emitCJS: true,
  },
  entries: [
    { input: 'src/content', name: 'content' },
    { input: 'src/cli', name: 'cli' },
  ],
  externals: [
    'h3',
    'yoga-wasm-web',
    'nitropack',
    '@nuxt/content',
    'zod',
    'nuxt',
    '#app',
    'nuxt/app',
    'h3',
    'nitropack',
    '@vue/runtime-core',
    '#og-image/components',
    'sharp',
    'unstorage',
    'unstorage/drivers/fs',
    'consola/utils',
    '#nitro-internal-virtual/storage',
    // @nuxt/fonts integration - fontless is only used when @nuxt/fonts is present
    'fontless',
    'unifont',
    'tailwindcss',
    // unocss (optional - only used when @unocss/nuxt is present)
    '@unocss/core',
    '@unocss/config',
    'unconfig',
    'unconfig-core',
    '@quansync/fs',
    'quansync',
    'quansync/macro',
    // lightningcss for CSS processing
    'lightningcss',
  ],
})
