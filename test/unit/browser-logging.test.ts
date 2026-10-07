import { fileURLToPath } from 'node:url'
import { build, createLogger } from 'vite'
import { expect, it } from 'vitest'

it('bundles the runtime logger for browsers without Node compatibility warnings', async () => {
  const warnings: string[] = []
  const logger = createLogger('warn')
  logger.warn = message => warnings.push(message)
  logger.warnOnce = logger.warn
  await build({
    configFile: false,
    plugins: [{
      name: 'browser-node-imports',
      enforce: 'pre',
      resolveId(id) {
        if (id.startsWith('node:'))
          throw new Error(`Browser logger imports ${id}`)
      },
    }],
    customLogger: logger,
    build: {
      write: false,
      rolldownOptions: {
        input: fileURLToPath(new URL('../../src/runtime/logger.ts', import.meta.url)),
        preserveEntrySignatures: 'strict',
        onLog(level, log, handler) {
          if (level === 'warn')
            warnings.push(log.message)
          handler(level, log)
        },
      },
    },
  })
  expect(warnings).not.toContainEqual(expect.stringContaining('node:tty'))
})
