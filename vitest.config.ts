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
            './test/unit/resvg-worker-queue.test.ts',
            './test/unit/takumi-worker-queue.test.ts',
            '**/.claude/**',
            '**/node_modules/**',
          ],
        },
      }),
      defineProject({
        test: {
          name: 'unit-forks',
          environment: 'node',
          // The binding tests saturate a native render thread each; running
          // the files in parallel makes render durations flaky.
          fileParallelism: false,
          // The worker bindings load a native addon inside a worker thread,
          // which deadlocks under the default worker-thread pool.
          pool: 'forks',
          include: [
            './test/unit/resvg-worker-queue.test.ts',
            './test/unit/takumi-worker-queue.test.ts',
          ],
          testTimeout: 30_000,
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
