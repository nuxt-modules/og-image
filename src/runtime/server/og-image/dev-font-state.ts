import { readFileSync, statSync } from 'node:fs'

export interface DevFontState {
  fonts: unknown[]
  available: unknown[]
  resolvedFontPaths: Record<string, string>
}

let cachedPath: string | undefined
let cachedVersion: string | undefined
let cached: DevFontState | undefined

/**
 * Development only. Components are analysed lazily, so the font list can change after Nitro is built;
 * the module rewrites this file instead of rebuilding Nitro. Parsed again only when the file changes.
 */
export function readDevFontState(path: string): DevFontState | undefined {
  try {
    const { mtimeMs, size } = statSync(path)
    const version = `${mtimeMs}:${size}`
    if (path !== cachedPath || version !== cachedVersion) {
      cached = JSON.parse(readFileSync(path, 'utf-8')) as DevFontState
      cachedPath = path
      cachedVersion = version
    }
    return cached
  }
  catch {
    return undefined
  }
}
