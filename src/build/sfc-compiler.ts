import { importResolvedModule } from './optional-module'

type SfcCompiler = typeof import('@vue/compiler-sfc')
type SfcCompilerModule = SfcCompiler | { default: SfcCompiler }

let sfcCompilerPath: string | undefined
let compilerPromise: Promise<SfcCompiler> | undefined
const SFC_COMPILER_ID = ['@vue', 'compiler-sfc'].join('/')

export function setSfcCompilerPath(path?: string): void {
  if (sfcCompilerPath === path)
    return
  sfcCompilerPath = path
  compilerPromise = undefined
}

export async function loadSfcCompiler(): Promise<SfcCompiler> {
  compilerPromise ||= importResolvedModule<SfcCompilerModule>(SFC_COMPILER_ID, sfcCompilerPath)
    .then((mod) => {
      const compiler = 'parse' in mod ? mod : mod.default
      if (typeof compiler.parse !== 'function')
        throw new TypeError('Invalid @vue/compiler-sfc module')
      return compiler
    })
    .catch((cause) => {
      throw new Error(
        '[nuxt-og-image] Could not resolve @vue/compiler-sfc from the Nuxt app. '
        + 'This should be provided by Nuxt through Vue. Install a compatible `vue` or `@vue/compiler-sfc` dependency.',
        { cause },
      )
    })
  return compilerPromise
}

export async function parseVueSfc(
  code: string,
  options?: Parameters<SfcCompiler['parse']>[1],
): Promise<ReturnType<SfcCompiler['parse']>> {
  const { parse } = await loadSfcCompiler()
  return parse(code, options)
}
