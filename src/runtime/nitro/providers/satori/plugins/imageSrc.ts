import { fileURLToPath } from 'node:url'
import { promises as fsp } from 'node:fs'
import { withBase } from 'ufo'
import { dirname, resolve } from 'pathe'
import type { VNode } from '../../../../../types'
import { defineSatoriTransformer } from '../utils'
import { getAsset } from '#internal/nitro/virtual/public-assets'

// for relative links we embed them as base64 input or just fix the URL to be absolute
export default defineSatoriTransformer((url) => {
  return {
    filter: (node: VNode) => node.type === 'img',
    transform: async (node: VNode) => {
      const src = node.props?.src as string | null
      if (src && src.startsWith('/')) {
        // find the file using getAsset
        const file = getAsset(src)
        if (file) {
          const serverDir = dirname(fileURLToPath(import.meta.url))
          const path = resolve(serverDir, file.path)
          node.props.src = `data:${file.type};base64,${await fsp.readFile(path, { encoding: 'base64' })}`
        }
        else {
          node.props.src = withBase(src, `${url.protocol}//${url.host}`)
        }
      }
    },
  }
})
