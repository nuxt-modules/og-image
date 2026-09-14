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
