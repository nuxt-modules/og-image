import satori, { init } from 'satori/wasm'
import initYoga from 'yoga-wasm-web'
import type { SatoriOptions } from 'satori'
import { wasmLoader } from '../../utils'

export default async function (nodes: string, options: SatoriOptions & { baseUrl: string }) {
  const loader = wasmLoader('/* NUXT_OG_IMAGE_YOGA_WASM */', '/yoga.wasm', options.baseUrl)

  if (!(await loader.loaded())) {
    const yoga = await initYoga(await loader.load())
    init(yoga)
  }
  return await satori(nodes, options)
}
