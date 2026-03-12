import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { expect } from 'vitest'

function isUpdateMode() {
  return process.argv.includes('--update') || process.argv.includes('-u')
}

expect.extend({
  toMatchImageSnapshot(received: Buffer | Uint8Array, snapshotPath: string) {
    const buffer = Buffer.isBuffer(received) ? received : Buffer.from(received)

    if (!existsSync(snapshotPath) || isUpdateMode()) {
      mkdirSync(dirname(snapshotPath), { recursive: true })
      writeFileSync(snapshotPath, buffer)
      return { pass: true, message: () => '' }
    }

    const expected = readFileSync(snapshotPath)
    const pass = buffer.equals(expected)

    if (!pass) {
      const diffDir = resolve(dirname(snapshotPath), '__diff_output__')
      mkdirSync(diffDir, { recursive: true })
      writeFileSync(resolve(diffDir, basename(snapshotPath)), buffer)
    }

    return {
      pass,
      message: () => pass
        ? 'Expected image not to match snapshot'
        : `Image snapshot mismatch: ${basename(snapshotPath)}\nExpected: ${expected.length} bytes\nReceived: ${buffer.length} bytes\nRun with --update to update.`,
    }
  },
})

declare module 'vitest' {
  interface Assertion<T = any> {
    toMatchImageSnapshot: (snapshotPath: string) => T
  }
}
