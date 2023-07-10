import { existsSync, promises as fsp } from 'node:fs'
import { Buffer } from 'node:buffer'
import type { H3Event } from 'h3'
import { getQuery } from 'h3'
import { join } from 'pathe'
import sizeOf from 'image-size'
import { defu } from 'defu'
import { withoutLeadingSlash } from 'ufo'
import type { RuntimeOgImageOptions } from '../types'
import { useNitroCache } from '../cache'
import { useNitroOrigin, useRuntimeConfig } from '#imports'

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

export async function fetchOptionsCached(e: H3Event, path: string) {
  const key = [
    withoutLeadingSlash((path === '/' || !path) ? 'index' : path).replaceAll('/', '-'),
    'options',
  ].join(':')
  const { cachedItem, update } = await useNitroCache<RuntimeOgImageOptions>(e, 'nuxt-og-image', {
    key,
    // allow internal requests to be cached
    cacheTtl: 5 * 1000,
    cache: !process.dev,
    headers: false,
  })
  if (cachedItem)
    return cachedItem as RuntimeOgImageOptions

  const options = await fetchOptions(e, path)
  await update(options)
  return options
}

export async function fetchOptions(e: H3Event, path: string): Promise<RuntimeOgImageOptions> {
  const options = await globalThis.$fetch('/api/og-image-options', {
    query: {
      path,
    },
    responseType: 'json',
  })
  return defu(
    { requestOrigin: useNitroOrigin(e) },
    options,
    // use query data
    getQuery(e),
  ) as RuntimeOgImageOptions
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
