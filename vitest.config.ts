import { fileURLToPath } from 'node:url'
import { defineConfig, defineProject } from 'vitest/config'

// Nitro sets this alias per preset. Unit tests run on Node.
const runtimeAlias = {
  '#og-image/bindings/fetch': fileURLToPath(new URL('./src/runtime/server/og-image/bindings/fetch/node.ts', import.meta.url)),
}

// Nuxt defines import.meta.prerender at build time; unit tests opt in via env.
const nuxtFlagsPlugin = {
  name: 'nuxt-import-meta-flags',
  transform(code: string, id: string) {
    if (!id.includes('/node_modules/') && !id.includes('/test/') && code.includes('import.meta.prerender'))
      return code.replaceAll('import.meta.prerender', 'Boolean(process.env.NUXT_PRERENDER)')
  },
}

export default defineConfig({
  test: {
    projects: [
      defineProject({
        resolve: { alias: runtimeAlias },
        plugins: [nuxtFlagsPlugin],
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
