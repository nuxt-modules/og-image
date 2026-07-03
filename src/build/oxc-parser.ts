import { importResolvedModule, resolveOptionalModulePath } from './optional-module'

export type OxcParseSync = (filename: string, sourceText: string, options?: unknown) => any
interface OxcParserModule { parseSync?: OxcParseSync }

let oxcParseSyncPath: string | undefined
let parseSyncPromise: Promise<OxcParseSync> | undefined

const OXC_PARSER_ID = ['oxc', 'parser'].join('-')
const ROLLDOWN_UTILS_ID = ['rolldown', 'utils'].join('/')

export function setOxcParseSyncPath(path?: string): void {
  if (oxcParseSyncPath === path)
    return
  oxcParseSyncPath = path
  parseSyncPromise = undefined
}

export async function resolveOxcParseSyncPath(rootDir: string): Promise<string | undefined> {
  return await resolveOptionalModulePath(OXC_PARSER_ID, rootDir, ['nuxt', '@unhead/bundler'])
    ?? await resolveOptionalModulePath(ROLLDOWN_UTILS_ID, rootDir, ['rolldown'])
}

export async function loadOxcParseSync(): Promise<OxcParseSync> {
  parseSyncPromise ||= loadParseSync()
  return parseSyncPromise
}

async function loadParseSync(): Promise<OxcParseSync> {
  const candidates: Array<[string, string?]> = oxcParseSyncPath
    ? [[OXC_PARSER_ID, oxcParseSyncPath]]
    : [[OXC_PARSER_ID], [ROLLDOWN_UTILS_ID]]

  for (const [id, resolvedPath] of candidates) {
    const parseSync = (await importResolvedModule<OxcParserModule>(id, resolvedPath).catch(() => null))?.parseSync
    if (typeof parseSync === 'function')
      return parseSync
  }

  throw new Error(
    '[nuxt-og-image] Could not resolve an OXC parser from the Nuxt app. '
    + 'This should be provided by Nuxt through `oxc-parser`. Install a compatible `nuxt`, `oxc-parser`, or `rolldown` dependency.',
  )
}
