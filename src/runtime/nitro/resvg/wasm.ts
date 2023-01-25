import type { ResvgRenderOptions } from '@resvg/resvg-wasm'
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import { resolvePath } from 'mlly'
import { dirname, join } from 'pathe'
import { $fetch } from 'ofetch'

let initialisedWasm = false
async function useResvgWasm() {
  let wasm: BufferSource | null = null
  if (initialisedWasm)
    return
  try {
    const path = join(
      dirname(await resolvePath('@resvg/resvg-wasm')),
      'index_bg.wasm',
    )
    const fs = await import('node:fs/promises')
    wasm = await fs.readFile(path)
  }
  catch (e) {
    wasm = await $fetch('https://unpkg.com/@resvg/resvg-wasm/index_bg.wasm', {
      responseType: 'arrayBuffer',
    })
  }
  if (wasm) {
    await initWasm(wasm)
    initialisedWasm = true
  }
}

export default async function (svg: string, options: ResvgRenderOptions) {
  await useResvgWasm()
  const resvg = new Resvg(svg, options)
  const pngData = resvg.render()
  return pngData.asPng()
}
