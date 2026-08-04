import { basename } from 'pathe'
import { logger } from '../runtime/logger'

export interface MigrationWarning {
  type: 'config' | 'component'
  code: string
  message: string
  replacement?: string
  file?: string
}

interface WarningCounts {
  config: Map<string, number>
  component: Map<string, number>
}

const warnings: MigrationWarning[] = []
const counts: WarningCounts = {
  config: new Map(),
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
  'runtimeBrowser': 'compatibility.runtime.browser',
  'runtimeSatori': 'compatibility.runtime.satori',
  'cacheTtl': 'cacheMaxAgeSeconds',
  'cache': 'cacheMaxAgeSeconds',
  'cacheQueryParams': 'Removed (all options are encoded in the URL path)',
  'cacheKey': 'Removed',
  'static': 'zeroRuntime',
  'chromium-node': 'compatibility.runtime.browser: \'playwright\'',
  'componentOptions': 'Removed (<OgImage> component removed, use defineOgImage())',
  'defaults.renderer': 'Removed (renderer determined by component filename suffix)',
  'defaults.component': 'Removed (rename component to OgImage/Default.{renderer}.vue)',
}

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

export function addComponentWarning(componentPath: string): void {
  addWarning({
    type: 'component',
    code: 'missing-suffix',
    message: `Component missing renderer suffix`,
    replacement: 'Rename to include .satori.vue, .takumi.vue, or .browser.vue',
    file: componentPath,
  })
}

export function hasWarnings(): boolean {
  return warnings.length > 0
    || counts.config.size > 0
    || counts.component.size > 0
}

export function emitWarnings(): void {
  if (hasEmitted || !hasWarnings())
    return

  hasEmitted = true

  const totalIssues = [...counts.config.values()].reduce((a, b) => a + b, 0)
    + [...counts.component.values()].reduce((a, b) => a + b, 0)

  const body = [
    formatWarnings(),
    '',
    `Found ${totalIssues} issue${totalIssues > 1 ? 's' : ''} requiring migration.`,
    '',
    'Run the migration command to fix automatically:',
    '',
    '  npx nuxt-og-image migrate v6',
    '',
    'Or preview changes first:',
    '',
    '  npx nuxt-og-image migrate v6 --dry-run',
    '',
    `Migration guide: https://nuxtseo.com/og-image/migration-guide/v6`,
  ].join('\n')

  logger.box({
    title: 'nuxt-og-image v6 Migration Required',
    message: body,
    style: {
      borderColor: 'yellow',
    },
  })
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
    lines.push('  → Rename to: *.satori.vue, *.takumi.vue, or *.browser.vue')
  }

  return lines.join('\n')
}
