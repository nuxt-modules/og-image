import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { parseAndWalk } from 'oxc-walker'
import { join } from 'pathe'

const valueTypes: Record<string, number> = { i: 0x7F, p: 0x7F, j: 0x7E, f: 0x7D, d: 0x7C }

function encodeLength(value: number): number[] {
  const bytes: number[] = []
  do {
    const byte = value & 0x7F
    value >>>= 7
    bytes.push(value ? byte | 0x80 : byte)
  } while (value)
  return bytes
}

/** Import one JS callback and export it with the required WASM function type. */
export function createHarfBuzzCallbackModule(signature: string): Uint8Array<ArrayBuffer> {
  const type = (character: string) => {
    const value = valueTypes[character]
    if (value === undefined)
      throw new Error(`Unsupported HarfBuzz callback type: ${character}`)
    return value
  }
  const params = [...signature.slice(1)].map(type)
  const results = signature[0] === 'v' ? [] : [type(signature[0]!)]
  const functionType = [1, 0x60, ...encodeLength(params.length), ...params, results.length, ...results]
  return Uint8Array.from([
    0,
    97,
    115,
    109,
    1,
    0,
    0,
    0,
    1,
    ...encodeLength(functionType.length),
    ...functionType,
    2,
    7,
    1,
    1,
    101,
    1,
    102,
    0,
    0,
    7,
    5,
    1,
    1,
    102,
    0,
    0,
  ])
}

export async function prepareHarfBuzzCallbacks(adapterPath: string, outputDir: string): Promise<string> {
  const signatures = new Set<string>()
  parseAndWalk(await readFile(adapterPath, 'utf8'), adapterPath, {
    enter(node) {
      if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier' || node.callee.name !== 'addFunction')
        return
      const signature = node.arguments[1]
      if (signature?.type === 'Literal' && typeof signature.value === 'string')
        signatures.add(signature.value)
    },
  })
  await mkdir(outputDir, { recursive: true })
  const entries = await Promise.all([...signatures].sort().map(async (signature) => {
    const path = join(outputDir, `callback-${signature}.wasm`)
    await writeFile(path, createHarfBuzzCallbackModule(signature))
    return { signature, path }
  }))
  return [
    ...entries.map(({ signature, path }) => `import ${signature} from ${JSON.stringify(`${path}?module`)}`),
    `export default { ${entries.map(({ signature }) => signature).join(', ')} }`,
  ].join('\n')
}

/** Replace Satori's bundled HarfBuzz loader with the runtime binding. */
export function externalizeSatoriHarfBuzz(code: string, id: string, specifier = 'harfbuzzjs'): string {
  const blocks: Array<{ start: number, end: number }> = []
  const loaders: Array<{ start: number, end: number, target: string }> = []
  parseAndWalk(code, id, {
    enter(node) {
      if (node.type === 'BlockStatement')
        blocks.push(node)
      if (node.type !== 'AssignmentExpression' || node.operator !== '='
        || node.left.type !== 'MemberExpression' || node.left.computed
        || node.left.property.type !== 'Identifier' || node.left.property.name !== 'exports'
        || node.right.type !== 'NewExpression' || node.right.callee.type !== 'Identifier'
        || node.right.callee.name !== 'Promise') {
        return
      }
      const block = blocks.at(-1)
      if (block)
        loaders.push({ ...block, target: code.slice(node.left.start, node.left.end) })
    },
    leave(node) {
      if (node.type === 'BlockStatement')
        blocks.pop()
    },
  })
  // The published standalone bundle has one CommonJS promise loader: HarfBuzz.
  // Fail at build time if upstream changes this contract.
  if (loaders.length !== 1)
    throw new Error(`Cannot replace the Satori HarfBuzz loader in ${id}: found ${loaders.length} loaders.`)
  const loader = loaders[0]!
  return `import _ogImageHarfBuzz from ${JSON.stringify(specifier)};\n${code.slice(0, loader.start)}{${loader.target} = _ogImageHarfBuzz;}${code.slice(loader.end)}`
}
