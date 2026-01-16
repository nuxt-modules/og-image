import { isCI } from 'std-env'
import { defineConfig, defineProject } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      // utils folders as *.test.ts in either test/unit or in src/**/*.test.ts
      defineProject({
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            './**/*.test.ts',
          ],
          exclude: [
            './test/e2e/**/*.test.ts',
            '**/node_modules/**',
          ],
        },
      }),
      // e2e tests in test/e2e - run sequentially to avoid resource exhaustion
      defineProject({
        test: {
          name: 'e2e',
          fileParallelism: isCI,
          include: [
            './test/e2e/**/*.test.ts',
          ],
          exclude: [
            '**/node_modules/**',
          ],
        },
      }),
    ],
  },
})
