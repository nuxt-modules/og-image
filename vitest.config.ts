/// <reference types="vitest" />
/// <reference types="vitest/globals" />

import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    threads: false,
    deps: {
      inline: [
        '@nuxt/test-utils',
        '@nuxt/test-utils-edge',
      ],
    },
    watchExclude: [
      'dist',
      'playground',
      'test/**/*',
      '**/.nuxt/**/*',
      '**/.output/**/*',
    ],
  },
})
