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
        'nuxt/server',
        'h3',
        'yoga-wasm-web',
        'nitropack',
        '@nuxt/content',
        'valibot',
        'zod',
        'nuxt',
        '#app',
        'nuxt/app',
        '@vue/runtime-core',
        '#og-image/components',
        'sharp',
        'unstorage',
        'unstorage/drivers/fs',
        'unstorage/drivers/fs-lite',
        'consola/utils',
        '#nitro-internal-virtual/storage',
        'fontless',
        'unifont',
        'tailwindcss',
        '@unocss/core',
        '@unocss/config',
        'unconfig',
        'unconfig-core',
        '@quansync/fs',
        'quansync',
        'quansync/macro',
        'lightningcss',
        'oxc-walker',
        'oxc-parser',
      ],
    }),
  ],
})
