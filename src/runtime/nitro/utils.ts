import { existsSync, promises as fsp } from 'node:fs'
import { Buffer } from 'node:buffer'
import type { H3Event } from 'h3'
import { getQuery } from 'h3'
import { join } from 'pathe'
import { prefixStorage } from 'unstorage'
import sizeOf from 'image-size'
import type { RuntimeOgImageOptions } from '../../types'
import { useNitroOrigin, useRuntimeConfig, useStorage } from '#imports'

export function wasmLoader(asyncModuleLoad: Promise<any> | Buffer | string, fallback: string) {
  let promise: Promise<any>
  let wasm: any
  return {
    async load(options: RuntimeOgImageOptions) {
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
          // fetch as base64
          wasm = await (await globalThis.$fetch(fallback, { baseURL: options.requestOrigin })).arrayBuffer()
          // read body as buffer
          wasm = Buffer.from(wasm)
        }
        resolve(wasm)
      })
      return promise
    },
  }
}
export async function fetchOptions(e: H3Event, path: string): Promise<RuntimeOgImageOptions> {
  const { runtimeCacheStorage } = useRuntimeConfig()['nuxt-og-image']
  const baseCacheKey = runtimeCacheStorage === 'default' ? '/cache/og-image' : '/og-image'
  const cache = (runtimeCacheStorage || process.env.prerender) ? prefixStorage(useStorage(), `${baseCacheKey}/options`) : false

  let options
  // check the cache first
  if (!process.dev && cache && await cache.hasItem(path)) {
    const cachedValue = await cache.getItem(path) as any
    if (cachedValue && cachedValue.value && cachedValue.expiresAt < Date.now())
      options = cachedValue.value
    else
      await cache.removeItem(path)
  }
  if (!options) {
    options = await globalThis.$fetch('/api/og-image-options', {
      query: {
        path,
      },
      responseType: 'json',
    })

    if (cache) {
      await cache.setItem(path, {
        value: options,
        expiresAt: Date.now() + (options.cache ? 60 * 60 * 1000 : 5 * 1000),
      })
    }
  }
  return {
    ...options,
    // use query data
    ...getQuery(e),
    requestOrigin: useNitroOrigin(e),
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

export async function readPublicAssetBase64(file: string): Promise<{ src: string; width?: number; height?: number } | undefined> {
  // we want the data in Uint8Array format
  const base64 = (await readPublicAsset(file, 'base64')) as string
  if (base64) {
    const dimensions = await sizeOf(Buffer.from(base64, 'base64'))
    return {
      src: toBase64Image(file, base64),
      ...dimensions,
    }
  }
}

export function toBase64Image(fileName: string, data: string | ArrayBuffer) {
  const base64 = typeof data === 'string' ? data : Buffer.from(data).toString('base64')
  let type = 'image/jpeg'
  // guess type from file name
  const ext = fileName.split('.').pop()
  if (ext === 'svg')
    type = 'image/svg+xml'
  else if (ext === 'png')
    type = 'image/png'
  return `data:${type};base64,${base64}`
}

export * from './utils-pure'
