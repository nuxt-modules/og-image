import type { Nuxt } from '@nuxt/schema'
import type { RuntimeCompatibilitySchema } from '../runtime/types'
import { addDependency, detectPackageManager } from 'nypm'
import { hasTTY, isAgent, isCI } from 'std-env'
import { getPresetNitroPresetCompatibility, resolveOgImagePreset } from '../compatibility'
import { logger } from '../runtime/logger'
import { hasResolvableDependency } from '../util'

export type ProviderName = 'satori' | 'takumi' | 'browser'
export type BindingVariant = 'node' | 'wasm' | 'wasm-fs'

export interface ProviderDependency {
  name: string
  description: string
  installSpec?: string
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

export const TAKUMI_INSTALL_TAG = 'rc'
export const TAKUMI_CORE_PACKAGE = '@takumi-rs/core'
export const TAKUMI_WASM_PACKAGE = '@takumi-rs/wasm'
export const TAKUMI_CORE_INSTALL_SPEC = `${TAKUMI_CORE_PACKAGE}@${TAKUMI_INSTALL_TAG}`
export const TAKUMI_WASM_INSTALL_SPEC = `${TAKUMI_WASM_PACKAGE}@${TAKUMI_INSTALL_TAG}`

export const PROVIDER_DEPENDENCIES: ProviderDefinition[] = [
  {
    name: 'satori',
    description: 'SVG-based renderer using Satori',
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
    description: 'Rust-based high-performance renderer (recommended)',
    bindings: {
      'node': [
        { name: TAKUMI_CORE_PACKAGE, installSpec: TAKUMI_CORE_INSTALL_SPEC, description: 'Native Takumi renderer' },
      ],
      'wasm': [
        { name: TAKUMI_WASM_PACKAGE, installSpec: TAKUMI_WASM_INSTALL_SPEC, description: 'WASM Takumi renderer' },
      ],
      'wasm-fs': [
        { name: TAKUMI_WASM_PACKAGE, installSpec: TAKUMI_WASM_INSTALL_SPEC, description: 'WASM Takumi renderer' },
      ],
    },
  },
  {
    name: 'browser',
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
]

export async function getInstalledProviders(): Promise<{ provider: ProviderName, binding: BindingVariant }[]> {
  const installed: { provider: ProviderName, binding: BindingVariant }[] = []

  for (const provider of PROVIDER_DEPENDENCIES) {
    // check node bindings first
    if (provider.bindings.node) {
      const allNodeInstalled = await Promise.all(
        provider.bindings.node.map(dep => hasResolvableDependency(dep.name)),
      )
      if (allNodeInstalled.every(Boolean)) {
        installed.push({ provider: provider.name, binding: 'node' })
        continue
      }
    }
    // check wasm bindings
    if (provider.bindings.wasm) {
      const allWasmInstalled = await Promise.all(
        provider.bindings.wasm.map(dep => hasResolvableDependency(dep.name)),
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
  const missing = await getMissingProviderDependencyDefinitions(provider, binding)
  return missing.map(d => d.name)
}

async function getMissingProviderDependencyDefinitions(
  provider: ProviderName,
  binding: BindingVariant = 'node',
): Promise<ProviderDependency[]> {
  const providerDef = PROVIDER_DEPENDENCIES.find(p => p.name === provider)
  if (!providerDef)
    return []

  const deps = providerDef.bindings[binding] || providerDef.bindings.node || []
  const missing: ProviderDependency[] = []

  for (const dep of deps) {
    if (!await hasResolvableDependency(dep.name))
      missing.push(dep)
  }

  return missing
}

function getDependencyDefinitions(
  provider: ProviderName,
  binding: BindingVariant = 'node',
): ProviderDependency[] {
  const providerDef = PROVIDER_DEPENDENCIES.find(p => p.name === provider)
  if (!providerDef)
    return []

  return providerDef.bindings[binding] || providerDef.bindings.node || []
}

export function getDependencyInstallSpec(dep: ProviderDependency): string {
  return dep.installSpec || dep.name
}

export async function getMissingDependencyInstallSpecs(
  provider: ProviderName,
  binding: BindingVariant = 'node',
): Promise<string[]> {
  const missing = await getMissingProviderDependencyDefinitions(provider, binding)
  return missing.map(getDependencyInstallSpec)
}

export function getProviderDependencies(
  provider: ProviderName,
  binding: BindingVariant = 'node',
): string[] {
  return getDependencyDefinitions(provider, binding).map(d => d.name)
}

export function getProviderDependencyInstallSpecs(
  provider: ProviderName,
  binding: BindingVariant = 'node',
): string[] {
  return getDependencyDefinitions(provider, binding).map(getDependencyInstallSpec)
}

export function getRecommendedBindingFromPreset(provider: ProviderName): BindingVariant {
  const preset = resolveOgImagePreset()
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

  if (provider === 'browser') {
    // browser only has node binding
    return 'node'
  }

  return 'node'
}

export async function ensureProviderDependencies(
  provider: ProviderName,
  binding: BindingVariant,
  nuxt: Nuxt,
): Promise<{ success: boolean, installed: string[] }> {
  const missingDeps = await getMissingProviderDependencyDefinitions(provider, binding)

  if (missingDeps.length === 0)
    return { success: true, installed: [] }

  const missingInstallSpecs = missingDeps.map(getDependencyInstallSpec)

  const pm = await detectPackageManager(nuxt.options.rootDir)
  const pmName = pm?.name || 'npm'

  logger.info(`Installing ${provider} dependencies: ${missingInstallSpecs.join(', ')}`)

  const installed: string[] = []
  for (const dep of missingDeps) {
    const installSpec = getDependencyInstallSpec(dep)
    const success = await addDependency(installSpec, {
      cwd: nuxt.options.rootDir,
      dev: false,
    })
      .then(() => {
        installed.push(installSpec)
        return true
      })
      .catch(() => {
        logger.error(`Failed to install ${installSpec}. Run manually: ${pmName} add ${installSpec}`)
        return false
      })

    if (!success)
      return { success: false, installed }
  }

  return { success: true, installed }
}

export interface InteractiveEnv {
  /** stdout is a TTY (std-env `hasTTY`, derived from `process.stdout.isTTY`) */
  hasTTY: boolean
  /** stdin is a TTY — prompts read from stdin, so a piped/redirected stdin can't answer */
  hasStdinTTY: boolean
  isAgent: boolean
  isCI: boolean
}

/**
 * Whether we can safely show an interactive prompt. AI agents and CI runners have no
 * TTY to answer a `consola.prompt`, so prompting there hangs or crashes the dev boot.
 *
 * Both stdout AND stdin must be TTYs: `std-env`'s `hasTTY` only reflects stdout, but a
 * prompt reads from stdin, so a redirected/piped stdin (e.g. `nuxt dev < /dev/null`, or a
 * parent spawning with `stdio: ['pipe', 'inherit', 'inherit']`) can never deliver an answer
 * even when the terminal output looks interactive.
 */
export function canPromptInteractively(env: InteractiveEnv = {
  hasTTY,
  hasStdinTTY: Boolean(process.stdin?.isTTY),
  isAgent,
  isCI,
}): boolean {
  return env.hasTTY && env.hasStdinTTY && !env.isAgent && !env.isCI
}

export async function promptForRendererSelection(): Promise<ProviderName> {
  logger.info('Welcome to Nuxt OG Image! No renderer dependencies detected.')
  const renderer = await logger.prompt('Which renderer would you like to use?', {
    type: 'select',
    options: PROVIDER_DEPENDENCIES.map(p => p.name),
    initial: 'takumi',
  })
  return (renderer as ProviderName) || 'takumi'
}

export async function validateProviderSetup(
  renderer: ProviderName,
  compatibility: RuntimeCompatibilitySchema,
): Promise<{ valid: boolean, issues: string[] }> {
  const issues: string[] = []
  const binding = getRecommendedBinding(renderer, compatibility)
  const missing = await getMissingDependencyInstallSpecs(renderer, binding)

  if (missing.length > 0) {
    issues.push(`Missing ${renderer} dependencies: ${missing.join(', ')}`)
  }

  // provider-specific checks
  if (renderer === 'satori') {
    const hasResvgNode = await hasResolvableDependency('@resvg/resvg-js')
    const hasResvgWasm = await hasResolvableDependency('@resvg/resvg-wasm')
    if (!hasResvgNode && !hasResvgWasm) {
      issues.push('Satori requires either @resvg/resvg-js (node) or @resvg/resvg-wasm to render PNGs')
    }
  }

  if (renderer === 'browser') {
    const hasPlaywright = await hasResolvableDependency('playwright-core')
    if (!hasPlaywright && binding === 'node') {
      issues.push('Browser renderer requires playwright-core')
    }
  }

  return { valid: issues.length === 0, issues }
}
