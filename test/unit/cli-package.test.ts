import { readFileSync } from 'node:fs'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'

interface PackageManifest {
  bin?: Record<string, string>
  dependencies?: Record<string, string>
  name?: string
  peerDependencies?: Record<string, string>
}

function readPackageJson(path: string): PackageManifest {
  return JSON.parse(readFileSync(path, 'utf8')) as PackageManifest
}

describe('cli package', () => {
  const rootDir = join(__dirname, '../..')
  const modulePackage = readPackageJson(join(rootDir, 'package.json'))
  const cliPackage = readPackageJson(join(rootDir, 'packages/cli/package.json'))

  it('keeps CLI metadata out of nuxt-og-image', () => {
    expect(modulePackage.bin).toBeUndefined()
    expect(modulePackage.dependencies?.['@clack/prompts']).toBeUndefined()
  })

  it('publishes the CLI from nuxt-og-image-cli', () => {
    expect(cliPackage.name).toBe('nuxt-og-image-cli')
    expect(cliPackage.bin).toEqual({ 'nuxt-og-image': './bin/cli.mjs' })
    expect(cliPackage.peerDependencies?.['nuxt-og-image']).toBe('workspace:^')
  })
})
