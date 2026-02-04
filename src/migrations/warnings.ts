import { basename } from 'pathe'
import { logger } from '../runtime/logger'

export interface MigrationWarning {
  type: 'config' | 'composable' | 'component'
  code: string
  message: string
  replacement?: string
  file?: string
}

interface WarningCounts {
  config: Map<string, number>
  composable: Map<string, number>
  component: Map<string, number>
}

const warnings: MigrationWarning[] = []
const counts: WarningCounts = {
  config: new Map(),
  composable: new Map(),
  component: new Map(),
}
let hasEmitted = false

// Config options removed/deprecated in v6
export const REMOVED_CONFIG: Record<string, string> = {
  'fonts': '@nuxt/fonts module',
  'strictNuxtContentPaths': 'Removed (no effect in Content v3)',
  'playground': 'Removed (use Nuxt DevTools)',
  'host': 'site.url or NUXT_SITE_URL',
  'siteUrl': 'site.url or NUXT_SITE_URL',
  'runtimeBrowser': 'compatibility.runtime.chromium',
  'runtimeSatori': 'compatibility.runtime.satori',
  'cacheTtl': 'cacheMaxAgeSeconds',
  'cache': 'cacheMaxAgeSeconds',
  'cacheKey': 'Removed',
  'static': 'zeroRuntime',
  'chromium-node': 'compatibility.runtime.chromium: \'playwright\'',
}

// Deprecated composables
export const DEPRECATED_COMPOSABLES: Record<string, string> = {
  defineOgImageComponent: 'defineOgImage()',
  defineOgImageStatic: 'defineOgImage()',
  defineOgImageDynamic: 'defineOgImage()',
  defineOgImageCached: 'defineOgImage()',
  defineOgImageWithoutCache: 'defineOgImage()',
}

// chromium: 'node' is deprecated
export const DEPRECATED_CHROMIUM_NODE = 'chromium: \'node\' binding removed, use \'playwright\''

export function addWarning(warning: MigrationWarning): void {
  const countMap = counts[warning.type]
  const current = countMap.get(warning.code) || 0
  countMap.set(warning.code, current + 1)

  // Only store first 3 of each type for detailed messages
  if (current < 3) {
    warnings.push(warning)
  }
}

export function addConfigWarning(key: string): void {
  const replacement = REMOVED_CONFIG[key]
  if (replacement) {
    addWarning({
      type: 'config',
      code: key,
      message: `ogImage.${key} is removed`,
      replacement,
    })
  }
}

export function addComposableWarning(name: string, file?: string): void {
  const replacement = DEPRECATED_COMPOSABLES[name]
  if (replacement) {
    addWarning({
      type: 'composable',
      code: name,
      message: `${name}() is deprecated`,
      replacement,
      file,
    })
  }
}

export function addComponentWarning(componentPath: string): void {
  addWarning({
    type: 'component',
    code: 'missing-suffix',
    message: `Component missing renderer suffix`,
    replacement: 'Rename to include .satori.vue, .takumi.vue, or .chromium.vue',
    file: componentPath,
  })
}

export function hasWarnings(): boolean {
  return warnings.length > 0
    || counts.config.size > 0
    || counts.composable.size > 0
    || counts.component.size > 0
}

export function emitWarnings(): void {
  if (hasEmitted || !hasWarnings())
    return

  hasEmitted = true

  const totalIssues = [...counts.config.values()].reduce((a, b) => a + b, 0)
    + [...counts.composable.values()].reduce((a, b) => a + b, 0)
    + [...counts.component.values()].reduce((a, b) => a + b, 0)

  logger.warn('')
  logger.warn('┌─────────────────────────────────────────────┐')
  logger.warn('│  nuxt-og-image v6 Migration Required        │')
  logger.warn('└─────────────────────────────────────────────┘')
  logger.warn('')

  const lines = formatWarnings().split('\n')
  for (const line of lines) {
    logger.warn(line)
  }

  logger.warn('')
  logger.warn(`Found ${totalIssues} issue${totalIssues > 1 ? 's' : ''} requiring migration.`)
  logger.warn('')
  logger.warn('Run the migration command to fix automatically:')
  logger.warn('')
  logger.warn('  npx nuxt-og-image migrate v6')
  logger.warn('')
  logger.warn('Or preview changes first:')
  logger.warn('')
  logger.warn('  npx nuxt-og-image migrate v6 --dry-run')
  logger.warn('')
  logger.info('Migration guide: https://nuxtseo.com/og-image/migration-guide/v6')
  logger.warn('')
}

function formatWarnings(): string {
  const lines: string[] = []

  // Config warnings
  if (counts.config.size > 0) {
    lines.push('Config options removed:')
    for (const [key, count] of counts.config) {
      const replacement = REMOVED_CONFIG[key]
      const suffix = count > 1 ? ` (×${count})` : ''
      lines.push(`  • ogImage.${key}${suffix}`)
      if (replacement)
        lines.push(`    → Use: ${replacement}`)
    }
    lines.push('')
  }

  // Composable warnings
  if (counts.composable.size > 0) {
    lines.push('Deprecated composables:')
    for (const [name, count] of counts.composable) {
      const replacement = DEPRECATED_COMPOSABLES[name]
      const suffix = count > 1 ? ` (×${count})` : ''
      lines.push(`  • ${name}()${suffix}`)
      if (replacement)
        lines.push(`    → Use: ${replacement}`)
    }
    lines.push('')
  }

  // Component warnings
  if (counts.component.size > 0) {
    const componentCount = [...counts.component.values()].reduce((a, b) => a + b, 0)
    lines.push(`Components missing renderer suffix: ${componentCount}`)
    const shown = warnings.filter(w => w.type === 'component').slice(0, 3)
    for (const w of shown) {
      if (w.file)
        lines.push(`  • ${basename(w.file)}`)
    }
    if (componentCount > 3) {
      lines.push(`  • ... and ${componentCount - 3} more`)
    }
    lines.push('  → Rename to: *.satori.vue, *.takumi.vue, or *.chromium.vue')
  }

  return lines.join('\n')
}

export function resetWarnings(): void {
  warnings.length = 0
  counts.config.clear()
  counts.composable.clear()
  counts.component.clear()
  hasEmitted = false
}
