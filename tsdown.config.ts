import { builder } from '@nuxt/module-builder/tsdown'
import { defineConfig } from 'tsdown'

export default defineConfig({
  outputOptions: {
    chunkFileNames: 'chunks/[name].mjs',
    minifyInternalExports: false,
  },
  plugins: [
    builder({
      entries: [
        './src/content',
        './src/content-valibot',
        './src/cli',
      ],
      externals: [
        'h3',
        'yoga-wasm-web',
        'nitropack',
        '@nuxt/content',
        '@vue/runtime-core',
        '#og-image/components',
        '#nitro-internal-virtual/storage',
        'unconfig',
        'unconfig-core',
        '@quansync/fs',
        'quansync',
      ],
    }),
  ],
})
