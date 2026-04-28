import { defineConfig, defineProject } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            './**/*.test.ts',
          ],
          exclude: [
            './test/e2e/**/*.test.ts',
            './test/e2e-not-nuxt/**/*.test.ts',
            '**/.claude/**',
            '**/node_modules/**',
          ],
        },
      }),
      defineProject({
        test: {
          name: 'e2e',
          // fileParallelism: isCI,
          include: [
            './test/e2e/**/*.test.ts',
            './test/e2e-not-nuxt/**/*.test.ts',
          ],
          exclude: [
            '**/.claude/**',
            '**/node_modules/**',
          ],
          hookTimeout: 240_000,
        },
      }),
    ],
  },
})
