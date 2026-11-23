import type { OgImageComponent } from '../../src/runtime/types'
import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDevComponentNamesProxy, readDevComponentNames } from '../../src/runtime/server/og-image/dev-component-names'

function atomicWriteJson(filePath: string, data: unknown) {
  const tmpPath = `${filePath}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(tmpPath, JSON.stringify(data), 'utf-8')
  renameSync(tmpPath, filePath)
}

function makeComponent(overrides: Partial<OgImageComponent> = {}): OgImageComponent {
  return {
    hash: 'hash-v1',
    pascalName: 'OgImageCardSatori',
    kebabName: 'og-image-card-satori',
    path: '/project/app/components/OgImage/Card.satori.vue',
    category: 'app',
    renderer: 'satori',
    propNames: ['title'],
    ...overrides,
  }
}

describe('dev-component-names', () => {
  let tempDir: string
  let statePath: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'og-image-dev-components-'))
    statePath = join(tempDir, 'dev-component-names.json')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('falls back to embedded components when state file does not exist or is invalid', () => {
    const fallback = [makeComponent()]
    const proxy = createDevComponentNamesProxy(statePath, fallback)

    expect(Array.isArray(proxy)).toBe(true)
    expect(proxy.length).toBe(1)
    expect(proxy[0]?.propNames).toEqual(['title'])

    writeFileSync(statePath, '{ invalid json', 'utf-8')
    expect(readDevComponentNames(statePath)).toBeUndefined()
    expect(proxy[0]?.propNames).toEqual(['title'])

    writeFileSync(statePath, JSON.stringify({ notAnArray: true }), 'utf-8')
    expect(readDevComponentNames(statePath)).toBeUndefined()
    expect(proxy[0]?.propNames).toEqual(['title'])
  })

  it('reflects updated propNames and hash after atomic rewrites without recreating the proxy', () => {
    const fallback = [makeComponent({ hash: 'h1', propNames: ['title'] })]
    const proxy = createDevComponentNamesProxy(statePath, fallback)

    atomicWriteJson(statePath, [makeComponent({ hash: 'h2', propNames: ['title', 'subtitle'] })])
    expect(proxy.find(c => c.pascalName === 'OgImageCardSatori')?.propNames).toEqual(['title', 'subtitle'])
    expect(proxy.find(c => c.pascalName === 'OgImageCardSatori')?.hash).toBe('h2')

    // Same byte-length rename (subtitle -> headline) should still invalidate cache via ino/mtimeNs
    atomicWriteJson(statePath, [makeComponent({ hash: 'h3', propNames: ['title', 'headline'] })])
    expect(proxy.find(c => c.pascalName === 'OgImageCardSatori')?.propNames).toEqual(['title', 'headline'])
    expect(proxy[0]?.hash).toBe('h3')
  })

  it('supports Array operations, iteration, and JSON.stringify when length changes', () => {
    const fallback = [makeComponent()]
    const proxy = createDevComponentNamesProxy(statePath, fallback)

    const updated = [
      makeComponent({ hash: 'h2', propNames: ['title', 'badge'] }),
      makeComponent({
        hash: 'h-post',
        pascalName: 'OgImagePostSatori',
        kebabName: 'og-image-post-satori',
        propNames: ['author'],
      }),
    ]
    atomicWriteJson(statePath, updated)

    expect(Array.isArray(proxy)).toBe(true)
    expect(proxy.length).toBe(2)
    expect(proxy.filter(c => c.renderer === 'satori')).toHaveLength(2)
    expect([...proxy].map(c => c.pascalName)).toEqual(['OgImageCardSatori', 'OgImagePostSatori'])
    expect(Object.keys(proxy)).toEqual(['0', '1'])
    expect(JSON.parse(JSON.stringify({ componentNames: proxy }))).toEqual({ componentNames: updated })
  })
})
