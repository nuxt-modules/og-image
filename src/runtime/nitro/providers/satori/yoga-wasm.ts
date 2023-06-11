import satori, { init } from 'satori/wasm'
import initYoga from 'yoga-wasm-web'
import type { SatoriOptions } from 'satori'
import { wasmLoader } from '../../utils'
import type { RuntimeOgImageOptions } from '../../../../types'

const YogaLoader = wasmLoader('/* NUXT_OG_IMAGE_YOGA_WASM */', '/yoga.wasm')

export default async function (nodes: string, options: SatoriOptions & RuntimeOgImageOptions) {
  const yogaWasm = await YogaLoader.load(options)
  const yoga = await initYoga(yogaWasm)
  init(yoga)
  return await satori(nodes, options)
}
