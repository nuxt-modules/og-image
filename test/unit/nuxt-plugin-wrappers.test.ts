import { readFileSync } from 'node:fs'
import { parseAndWalk } from 'oxc-walker'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'

const pluginPaths = [
  'og-image-canonical-urls.server.ts',
  'route-rule-og-image.server.ts',
]

describe('nuxt plugin entrypoints', () => {
  it.each(pluginPaths)('wraps %s with defineNuxtPlugin', (pluginPath) => {
    const path = join(__dirname, '../../src/runtime/app/plugins', pluginPath)
    const code = readFileSync(path, 'utf8')
    let wrapped = false

    parseAndWalk(code, path, (node) => {
      if (
        node.type === 'CallExpression'
        && node.callee.type === 'Identifier'
        && node.callee.name === 'defineNuxtPlugin'
      ) {
        wrapped = true
      }
    })

    expect(wrapped).toBe(true)
  })
})
