import satori, { init } from 'satori/wasm'
import initYoga from 'yoga-wasm-web'
import type { SatoriOptions } from 'satori'
import { wasmLoader } from '../../utils'

const YogaLoader = wasmLoader('/* NUXT_OG_IMAGE_YOGA_WASM */', '/yoga.wasm')

export default async function (nodes: string, options: SatoriOptions & { baseUrl: string }) {
  const yogaWasm = await YogaLoader.load({ baseUrl: options.baseUrl })
  const yoga = await initYoga(yogaWasm)
  init(yoga)
  return await satori(nodes, options)
}
