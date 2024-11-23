/// <reference types="vitest" />
/// <reference types="vitest/globals" />

import { defineVitestConfig } from '@nuxt/test-utils/config'
import { isCI } from 'std-env'

export default defineVitestConfig({
  test: {
    threads: isCI,
    watchExclude: [
      'dist',
      'playground',
      'test/**/*',
      '**/.nuxt/**/*',
      '**/.output/**/*',
    ],
  },
})
