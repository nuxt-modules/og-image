import { existsSync, promises as fsp } from 'node:fs'
import { Buffer } from 'node:buffer'
import type { H3Event } from 'h3'
import { getQuery } from 'h3'
import { join } from 'pathe'
import { prefixStorage } from 'unstorage'
import type { OgImageOptions } from '../../types'
import { useRuntimeConfig, useStorage } from '#imports'
import { useNitroApp } from '#internal/nitro'

export * from './util-hostname'

export function wasmLoader(asyncModuleLoad: Promise<any> | Buffer | string, fallback: string) {
  let promise: Promise<any>
  let wasm: any
  return {
    async load(options: { baseUrl: string }) {
      if (typeof promise !== 'undefined')
        return promise
      if (wasm)
        return wasm
      // eslint-disable-next-line no-async-promise-executor
      promise = promise || new Promise(async (resolve) => {
        try {
          wasm = await asyncModuleLoad
          if (typeof wasm === 'string')
            wasm = undefined
        }
        catch (e) {
        }
        if (!wasm) {
          wasm = await readPublicAsset(fallback, 'base64')
          if (wasm)
            wasm = Buffer.from(wasm, 'base64')
        }
        if (!wasm) {
          // fallback to fetch
          const url = new URL(options.baseUrl)
          // fetch as base64
          wasm = await (await globalThis.$fetch(fallback, { baseURL: url.origin })).arrayBuffer()
          // read body as buffer
          wasm = Buffer.from(wasm)
        }
        resolve(wasm)
      })
      return promise
    },
  }
}
export async function fetchOptions(e: H3Event, path: string): Promise<OgImageOptions> {
  const { runtimeCacheStorage } = useRuntimeConfig()['nuxt-og-image']
  const cache = (runtimeCacheStorage || process.env.prerender) ? prefixStorage(useStorage(), 'og-image-cache:options') : false

  let options
  // check the cache first
  if (cache && await cache.hasItem(path)) {
    const cachedValue = await cache.getItem(path) as any
    if (cachedValue && cachedValue.value && cachedValue.expiresAt < Date.now())
      options = cachedValue.value
    else
      await cache.removeItem(path)
  }
  if (!options) {
    const nitro = useNitroApp()
    options = await (await nitro.localFetch(`/api/og-image-options?path=${path}`)).json()

    if (cache) {
      await cache.setItem(path, {
        value: options,
        expiresAt: Date.now() + (options.static ? 60 * 60 * 1000 : 5 * 1000),
      })
    }
  }
  return {
    ...options,
    // use query data
    ...getQuery(e),
  }
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Decode the base64 string into a binary string
  const buffer = Buffer.from(base64, 'base64')
  return new Uint8Array(buffer).buffer
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
