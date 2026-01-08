import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  rollup: {
    emitCJS: true,
  },
  entries: [
    { input: 'src/content', name: 'content' },
  ],
  externals: [
    'h3',
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
  ],
})
