import { existsSync } from 'node:fs'
import { isAbsolute, join, normalize } from 'pathe'

export interface ResolveWatchedPathOptions {
  rootDir: string
  srcDir: string
  exists?: (path: string) => boolean
  caseInsensitive?: boolean
}

function normalizeForCompare(path: string, caseInsensitive: boolean): string {
  const normalized = normalize(path).replace(/\/+$/, '')
  return caseInsensitive ? normalized.toLowerCase() : normalized
}

export function isSamePath(
  a: string,
  b: string,
  caseInsensitive = process.platform === 'win32',
): boolean {
  return normalizeForCompare(a, caseInsensitive) === normalizeForCompare(b, caseInsensitive)
}

export function isPathWithinDir(
  filePath: string,
  dirPath: string,
  caseInsensitive = process.platform === 'win32',
): boolean {
  const normalizedFile = normalizeForCompare(filePath, caseInsensitive)
  const normalizedDir = normalizeForCompare(dirPath, caseInsensitive)
  return normalizedFile === normalizedDir || normalizedFile.startsWith(`${normalizedDir}/`)
}

export function resolveWatchedPath(
  relativePath: string,
  options: ResolveWatchedPathOptions,
): string {
  if (isAbsolute(relativePath))
    return normalize(relativePath)

  const exists = options.exists ?? existsSync
  const caseInsensitive = options.caseInsensitive ?? process.platform === 'win32'
  const srcPath = join(options.srcDir, relativePath)
  const rootPath = join(options.rootDir, relativePath)

  if (exists(srcPath))
    return srcPath
  if (exists(rootPath))
    return rootPath
  if (isPathWithinDir(rootPath, options.srcDir, caseInsensitive))
    return rootPath
  return srcPath
}

export function isOgImageComponentPath(
  absolutePath: string,
  srcDir: string,
  componentDirs: readonly string[],
  caseInsensitive = process.platform === 'win32',
): boolean {
  return componentDirs.some((dir) => {
    const componentDir = join(srcDir, 'components', dir)
    return isPathWithinDir(absolutePath, componentDir, caseInsensitive)
  })
}
