import { existsSync, promises as fsp } from 'node:fs'
import { Buffer } from 'node:buffer'
import type { H3Event } from 'h3'
import { getHeaders, getQuery } from 'h3'
import { join } from 'pathe'
import type { OgImageOptions } from '../../types'
import { useHostname } from './util-hostname'
import { optionCacheStorage } from './composables/cache'
import { useRuntimeConfig } from '#imports'

export * from './util-hostname'

export function wasmLoader(asyncModuleLoad: Promise<any>, fallback: string, baseUrl: string) {
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
          wasm = await asyncModuleLoad
          if (typeof wasm === 'string')
            wasm = undefined
        }
        catch (e) {
        }
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
export async function fetchOptions(e: H3Event, path: string): Promise<OgImageOptions> {
  const { runtimeCacheStorage } = useRuntimeConfig()['nuxt-og-image']
  const cache = runtimeCacheStorage ? prefixStorage(useStorage(), 'og-image-cache:options') : false

  // check the cache first
  if (cache && await cache.hasItem(path)) {
    const cachedValue = await cache.getItem(path) as any
    if (cachedValue && cachedValue.expiresAt < Date.now())
      return cachedValue.value
    else
      await cache.removeItem(path)
  }
  // extract the payload from the original path
  const fetchOptions = (process.dev || process.env.prerender)
    ? {
        headers: getHeaders(e),
      }
    : {
        baseURL: useHostname(e),
      }

  const res = await globalThis.$fetch<OgImageOptions>('/api/og-image-options', {
    query: {
      path,
    },
    ...fetchOptions,
  })
  if (cache) {
    await cache.setItem(path, {
      value: res,
      expiresAt: Date.now() + (res.static ? 60 * 60 * 1000 : 5 * 1000),
    })
  }
  return {
    ...res,
    // use query data
    ...getQuery(e),
  }
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

function r(base: string, key: string) {
  return join(base!, key.replace(/:/g, '/'))
}

export async function readPublicAsset(file: string, encoding?: BufferEncoding) {
  const { assetDirs } = useRuntimeConfig()['nuxt-og-image']
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

export * from './utils-pure'
