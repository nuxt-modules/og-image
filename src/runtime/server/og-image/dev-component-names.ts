import type { OgImageComponent } from '../../types'
import { readFileSync, statSync } from 'node:fs'

let cachedPath: string | undefined
let cachedVersion: string | undefined
let cached: OgImageComponent[] | undefined

/**
 * Development only. Component metadata (propNames, hash, credits) can change when an OG image
 * component is edited after Nitro is built; the module rewrites this file instead of rebuilding
 * Nitro. Parsed again only when the file changes.
 */
export function readDevComponentNames(path: string): OgImageComponent[] | undefined {
  try {
    const { ino, mtimeNs, size } = statSync(path, { bigint: true })
    const version = `${ino}:${mtimeNs}:${size}`
    if (path !== cachedPath || version !== cachedVersion) {
      const parsed = JSON.parse(readFileSync(path, 'utf-8'))
      if (!Array.isArray(parsed))
        return undefined
      cached = parsed as OgImageComponent[]
      cachedPath = path
      cachedVersion = version
    }
    return cached
  }
  catch {
    return undefined
  }
}

export function createDevComponentNamesProxy(
  path: string,
  fallback: OgImageComponent[],
): OgImageComponent[] {
  const getCurrent = () => readDevComponentNames(path) ?? fallback

  return new Proxy(fallback, {
    get(_target, prop) {
      const current = getCurrent()
      if (prop === 'toJSON')
        return () => current
      const value = Reflect.get(current, prop, current)
      return typeof value === 'function' ? value.bind(current) : value
    },
    has(_target, prop) {
      return Reflect.has(getCurrent(), prop)
    },
    ownKeys() {
      return Reflect.ownKeys(getCurrent())
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(getCurrent(), prop)
    },
  })
}
