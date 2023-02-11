import { existsSync, promises as fsp } from 'fs'
import type { H3Event } from 'h3'
import { getQuery, getRequestHeader } from 'h3'
import { join } from 'pathe'
import type { OgImageOptions } from '../../types'
import { assetDirs } from '#nuxt-og-image/config'

export function wasmLoader(key: any, fallback: string, baseUrl: string) {
  let promise: Promise<any>
  let loaded = false
  return {
    loaded() {
      if (loaded)
        return true
      // is loading
      if (typeof promise !== 'undefined')
        return promise
      return false
    },
    async load() {
      // eslint-disable-next-line no-async-promise-executor
      promise = promise || new Promise(async (resolve) => {
        let wasm
        try {
          wasm = await key
          if (typeof wasm === 'string')
            wasm = undefined
        }
        catch (e) {}
        // check cache first
        if (!wasm)
          wasm = await readPublicAsset(fallback)
        if (!wasm) {
          // fallback to fetch
          const url = new URL(baseUrl)
          wasm = await (await fetch(`${url.origin}${fallback}`)).arrayBuffer()
        }
        loaded = true
        resolve(wasm)
      })
      return promise
    },
  }
}
export function fetchOptions(e: H3Event, path: string) {
  return globalThis.$fetch<OgImageOptions>('/api/og-image-options', {
    query: {
      ...getQuery(e),
      path,
    },
  })
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Decode the base64 string into a binary string
  const buffer = Buffer.from(base64, 'base64')
  return new Uint8Array(buffer).buffer
}

export function renderIsland(payload: OgImageOptions) {
  return globalThis.$fetch<{ html: string; head: any }>(`/__nuxt_island/${payload.component}`, {
    query: { props: JSON.stringify(payload) },
  })
}

export function useHostname(e: H3Event) {
  const host = getRequestHeader(e, 'host') || 'localhost:3000'
  const protocol = getRequestHeader(e, 'x-forwarded-proto') || 'http'
  const useHttp = process.env.NODE_ENV === 'development' || host.includes('127.0.0.1') || host.includes('localhost') || protocol === 'http'
  return `http${useHttp ? '' : 's'}://${host}`
}

const r = (base: string, key: string) => {
  return join(base!, key.replace(/:/g, '/'))
}

export async function readPublicAsset(file: string, encoding?: BufferEncoding) {
  for (const assetDir of assetDirs) {
    const path = r(assetDir, file)
    if (existsSync(path))
      return await fsp.readFile(path, { encoding })
  }
}

export async function readPublicAssetBase64(file: string) {
  const base64 = await readPublicAsset(file, 'base64')
  if (base64) {
    let type = 'image/jpeg'
    // guess type from file name
    const ext = file.split('.').pop()
    if (ext === 'svg')
      type = 'image/svg+xml'
    else if (ext === 'png')
      type = 'image/png'
    return `data:${type};base64,${base64}`
  }
  // fine if it fails, we fallback elsewhere
}
