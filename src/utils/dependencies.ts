import type { Nuxt } from '@nuxt/schema'
import type { RuntimeCompatibilitySchema } from '../runtime/types'
import { addDependency, detectPackageManager } from 'nypm'
import { getPresetNitroPresetCompatibility, resolveNitroPreset } from '../compatibility'
import { logger } from '../runtime/logger'

export type ProviderName = 'satori' | 'takumi' | 'chromium'
export type BindingVariant = 'node' | 'wasm' | 'wasm-fs'

export interface ProviderDependency {
  name: string
  description: string
  optional?: boolean
}

export interface ProviderDefinition {
  name: ProviderName
  description: string
  bindings: {
    'node'?: ProviderDependency[]
    'wasm'?: ProviderDependency[]
    'wasm-fs'?: ProviderDependency[]
  }
}

export const PROVIDER_DEPENDENCIES: ProviderDefinition[] = [
  {
    name: 'satori',
    description: 'SVG-based renderer using Satori (default)',
    bindings: {
      'node': [
        { name: 'satori', description: 'HTML to SVG renderer' },
        { name: '@resvg/resvg-js', description: 'SVG to PNG converter (native)' },
      ],
      'wasm': [
        { name: 'satori', description: 'HTML to SVG renderer' },
        { name: '@resvg/resvg-wasm', description: 'SVG to PNG converter (WASM)' },
      ],
      'wasm-fs': [
        { name: 'satori', description: 'HTML to SVG renderer' },
        { name: '@resvg/resvg-wasm', description: 'SVG to PNG converter (WASM)' },
      ],
    },
  },
  {
    name: 'takumi',
    description: 'Rust-based high-performance renderer',
    bindings: {
      'node': [
        { name: '@takumi-rs/core', description: 'Native Takumi renderer' },
      ],
      'wasm': [
        { name: '@takumi-rs/wasm', description: 'WASM Takumi renderer' },
      ],
      'wasm-fs': [
        { name: '@takumi-rs/wasm', description: 'WASM Takumi renderer' },
      ],
    },
  },
  {
    name: 'chromium',
    description: 'Browser-based screenshot renderer',
    bindings: {
      node: [
        { name: 'playwright-core', description: 'Headless browser automation' },
      ],
    },
  },
]

export const OPTIONAL_DEPENDENCIES: ProviderDependency[] = [
  { name: 'sharp', description: 'JPEG image output support', optional: true },
  { name: '@css-inline/css-inline', description: 'CSS inlining (native)', optional: true },
  { name: '@css-inline/css-inline-wasm', description: 'CSS inlining (WASM)', optional: true },
]

export async function isPackageInstalled(packageName: string): Promise<boolean> {
  try {
    await import(packageName)
    return true
  }
  catch {
    return false
  }
}

export async function getInstalledProviders(): Promise<{ provider: ProviderName, binding: BindingVariant }[]> {
  const installed: { provider: ProviderName, binding: BindingVariant }[] = []

  for (const provider of PROVIDER_DEPENDENCIES) {
    // check node bindings first
    if (provider.bindings.node) {
      const allNodeInstalled = await Promise.all(
        provider.bindings.node.map(dep => isPackageInstalled(dep.name)),
      )
      if (allNodeInstalled.every(Boolean)) {
        installed.push({ provider: provider.name, binding: 'node' })
        continue
      }
    }
    // check wasm bindings
    if (provider.bindings.wasm) {
      const allWasmInstalled = await Promise.all(
        provider.bindings.wasm.map(dep => isPackageInstalled(dep.name)),
      )
      if (allWasmInstalled.every(Boolean)) {
        installed.push({ provider: provider.name, binding: 'wasm' })
      }
    }
  }

  return installed
}

export async function getMissingDependencies(
  provider: ProviderName,
  binding: BindingVariant = 'node',
): Promise<string[]> {
  const providerDef = PROVIDER_DEPENDENCIES.find(p => p.name === provider)
  if (!providerDef)
    return []

  const deps = providerDef.bindings[binding] || providerDef.bindings.node || []
  const missing: string[] = []

  for (const dep of deps) {
    if (!await isPackageInstalled(dep.name))
      missing.push(dep.name)
  }

  return missing
}

export function getProviderDependencies(
  provider: ProviderName,
  binding: BindingVariant = 'node',
): string[] {
  const providerDef = PROVIDER_DEPENDENCIES.find(p => p.name === provider)
  if (!providerDef)
    return []

  const deps = providerDef.bindings[binding] || providerDef.bindings.node || []
  return deps.map(d => d.name)
}

export function getRecommendedBindingFromPreset(provider: ProviderName): BindingVariant {
  const preset = resolveNitroPreset()
  const compatibility = getPresetNitroPresetCompatibility(preset)
  return getRecommendedBinding(provider, compatibility)
}

export function getRecommendedBinding(provider: ProviderName, compatibility: RuntimeCompatibilitySchema): BindingVariant {
  // check provider-specific binding from compatibility
  if (provider === 'satori') {
    const resvgBinding = compatibility.resvg
    if (resvgBinding === 'wasm-fs')
      return 'wasm-fs'
    if (resvgBinding === 'wasm')
      return 'wasm'
    return 'node'
  }

  if (provider === 'takumi') {
    const takumiBinding = compatibility.takumi
    if (takumiBinding === 'wasm')
      return 'wasm'
    return 'node'
  }

  if (provider === 'chromium') {
    // chromium only has node binding
    return 'node'
  }

  return 'node'
}

export async function ensureProviderDependencies(
  provider: ProviderName,
  binding: BindingVariant,
  nuxt: Nuxt,
): Promise<{ success: boolean, installed: string[] }> {
  const missing = await getMissingDependencies(provider, binding)

  if (missing.length === 0)
    return { success: true, installed: [] }

  const pm = await detectPackageManager(nuxt.options.rootDir)
  const pmName = pm?.name || 'npm'

  logger.info(`Installing ${provider} dependencies: ${missing.join(', ')}`)

  const installed: string[] = []
  for (const pkg of missing) {
    const success = await addDependency(pkg, {
      cwd: nuxt.options.rootDir,
      dev: false,
    })
      .then(() => {
        installed.push(pkg)
        return true
      })
      .catch(() => {
        logger.error(`Failed to install ${pkg}. Run manually: ${pmName} add ${pkg}`)
        return false
      })

    if (!success)
      return { success: false, installed }
  }

  return { success: true, installed }
}

export async function promptForDependencyInstall(
  pkg: string,
  nuxt: Nuxt,
): Promise<boolean> {
  if (await isPackageInstalled(pkg))
    return true

  const confirm = await logger.prompt(`Install \`${pkg}\`?`, {
    type: 'confirm',
    initial: true,
  })

  if (!confirm) {
    return false
  }

  return addDependency(pkg, {
    cwd: nuxt.options.rootDir,
  })
    .then(() => true)
    .catch(() => {
      logger.error(`Failed to install ${pkg}`)
      return false
    })
}

export async function validateProviderSetup(
  renderer: ProviderName,
  compatibility: RuntimeCompatibilitySchema,
): Promise<{ valid: boolean, issues: string[] }> {
  const issues: string[] = []
  const binding = getRecommendedBinding(renderer, compatibility)
  const missing = await getMissingDependencies(renderer, binding)

  if (missing.length > 0) {
    issues.push(`Missing ${renderer} dependencies: ${missing.join(', ')}`)
  }

  // provider-specific checks
  if (renderer === 'satori') {
    const hasResvgNode = await isPackageInstalled('@resvg/resvg-js')
    const hasResvgWasm = await isPackageInstalled('@resvg/resvg-wasm')
    if (!hasResvgNode && !hasResvgWasm) {
      issues.push('Satori requires either @resvg/resvg-js (node) or @resvg/resvg-wasm to render PNGs')
    }
  }

  if (renderer === 'chromium') {
    const hasPlaywright = await isPackageInstalled('playwright-core')
    if (!hasPlaywright && binding === 'node') {
      issues.push('Chromium renderer requires playwright-core')
    }
  }

  return { valid: issues.length === 0, issues }
}
