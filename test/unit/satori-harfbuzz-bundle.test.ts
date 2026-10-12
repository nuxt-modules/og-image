import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import MagicString from 'magic-string'
import { parseAndWalk } from 'oxc-walker'
import { describe, expect, it } from 'vitest'
import { externalizeSatoriHarfBuzz } from '../../src/build/harfbuzz'

const require = createRequire(import.meta.url)
const entry = fileURLToPath(import.meta.resolve('satori/standalone'))
const dependencyRequire = createRequire(entry)
const published = await readFile(entry, 'utf8')
const imports = new MagicString(published)
parseAndWalk(published, entry, {
  enter(node) {
    if (node.type === 'ImportDeclaration') {
      imports.overwrite(node.source.start, node.source.end, JSON.stringify(pathToFileURL(dependencyRequire.resolve(node.source.value)).href))
    }
  },
})
const source = imports.toString()

it('routes standalone text shaping through the supplied HarfBuzz binding', async () => {
  const binding = 'data:text/javascript,export default {then(resolve,reject){reject(new Error("custom HarfBuzz binding"))}}'
  const code = externalizeSatoriHarfBuzz(source, entry, binding)
  const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  await module.init(await readFile(require.resolve('satori/layout.wasm')))
  const font = await readFile(new URL('../../src/runtime/public/_og-fonts/inter-400-latin.ttf', import.meta.url))
  await expect(module.default({ type: 'div', props: { children: 'Hello' } }, {
    width: 300,
    height: 150,
    fonts: [{ name: 'Inter', data: font }],
  })).rejects.toThrow('custom HarfBuzz binding')
})

describe('bundled HarfBuzz boundary', () => {
  it('renders with an external HarfBuzz loader', async () => {
    const dependencyRequire = createRequire(require.resolve('satori/package.json'))
    const binding = pathToFileURL(dependencyRequire.resolve('harfbuzzjs')).href
    const code = externalizeSatoriHarfBuzz(source, entry, binding)
    const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
    await module.init(await readFile(require.resolve('satori/layout.wasm')))
    const font = await readFile(new URL('../../src/runtime/public/_og-fonts/inter-400-latin.ttf', import.meta.url))
    const svg = await module.default({ type: 'div', props: { children: 'Hello' } }, {
      width: 300,
      height: 150,
      fonts: [{ name: 'Inter', data: font }],
    })
    expect(svg).toContain('<path')
  })

  it('rejects an absent or ambiguous loader', () => {
    expect(() => externalizeSatoriHarfBuzz('export default 1', 'satori.js')).toThrow('found 0 loaders')
    expect(() => externalizeSatoriHarfBuzz('function a(m){m.exports=new Promise(()=>{})} function b(m){m.exports=new Promise(()=>{})}', 'satori.js')).toThrow('found 2 loaders')
  })
})
