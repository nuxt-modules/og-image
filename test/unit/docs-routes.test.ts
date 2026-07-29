import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { globbySync } from 'globby'
import { describe, expect, it } from 'vitest'

const docsDir = resolve(import.meta.dirname, '../../docs/content')
const renderersPage = resolve(docsDir, '2.renderers/0.index.md')
const retiredRoute = '/docs/og-image/guides/compatibility'

describe('documentation routes', () => {
  it('only publishes the canonical renderer compatibility documentation', () => {
    const docs = globbySync('**/*.md', { absolute: true, cwd: docsDir })
    expect(docs.filter(path => path.endsWith('.compatibility.md'))).toEqual([])
    expect(existsSync(renderersPage)).toBe(true)
    for (const path of docs)
      expect(readFileSync(path, 'utf8'), path).not.toContain(retiredRoute)
  })
})
