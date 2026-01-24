#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import { loadFile } from 'magicast'
import { addDependency, detectPackageManager } from 'nypm'

const __dirname = dirname(fileURLToPath(import.meta.url))

const communityDir = resolve(__dirname, 'runtime/app/components/Templates/Community')

// Default component directories (must match module.ts)
const defaultComponentDirs = ['OgImage', 'OgImageCommunity', 'og-image', 'OgImageTemplate']

// Renderer definitions with descriptions
const RENDERERS = [
  {
    name: 'satori',
    label: 'Satori',
    description: 'SVG-based renderer - fast, works everywhere (recommended)',
    deps: ['satori', '@resvg/resvg-js'],
  },
  {
    name: 'takumi',
    label: 'Takumi',
    description: 'Rust-based high-performance renderer',
    deps: ['@takumi-rs/core'],
  },
  {
    name: 'chromium',
    label: 'Chromium',
    description: 'Browser screenshot renderer - pixel-perfect but slower',
    deps: ['playwright-core'],
  },
] as const

type RendererName = typeof RENDERERS[number]['name']

// Template files are named like "NuxtSeo.satori.vue"
function getBaseName(filename: string): string {
  return filename.replace(/\.(satori|chromium|takumi)\.vue$/, '')
}

function hasRendererSuffix(filename: string): boolean {
  return /\.(?:satori|chromium|takumi)\.vue$/.test(filename)
}

function listTemplates() {
  const templates = readdirSync(communityDir)
    .filter(f => f.endsWith('.vue'))
    .map(getBaseName)
  console.log('\nAvailable community templates:')
  templates.forEach(t => console.log(`  - ${t}`))
  console.log('\nUsage: npx nuxt-og-image eject <template-name>\n')
}

function findTemplateFile(name: string): string | null {
  const files = readdirSync(communityDir).filter(f => f.endsWith('.vue'))
  const match = files.find(f => getBaseName(f) === name)
  return match || null
}

function ejectTemplate(name: string, targetDir: string) {
  const templateFile = findTemplateFile(name)
  if (!templateFile) {
    p.log.error(`Template "${name}" not found.`)
    listTemplates()
    process.exit(1)
  }

  const templatePath = join(communityDir, templateFile)
  const outputDir = resolve(targetDir, 'components', 'OgImage')
  if (!existsSync(outputDir))
    mkdirSync(outputDir, { recursive: true })

  const outputPath = join(outputDir, templateFile)
  if (existsSync(outputPath)) {
    p.log.error(`File already exists: ${outputPath}`)
    process.exit(1)
  }

  const content = readFileSync(templatePath, 'utf-8')
  writeFileSync(outputPath, content, 'utf-8')
  p.log.success(`Ejected "${name}" to ${outputPath}`)
}

// Find OgImage components in a directory
function findOgImageComponents(dir: string): string[] {
  const components: string[] = []

  for (const componentDir of defaultComponentDirs) {
    const ogImageDir = join(dir, 'components', componentDir)
    if (existsSync(ogImageDir)) {
      const files = readdirSync(ogImageDir, { withFileTypes: true })
      for (const file of files) {
        if (file.isFile() && file.name.endsWith('.vue'))
          components.push(join(ogImageDir, file.name))
      }
    }
  }

  return components
}

// Glob helper to find files recursively
function globFiles(dir: string, pattern: RegExp, exclude: RegExp[] = []): string[] {
  const results: string[] = []

  function walk(currentDir: string) {
    if (!existsSync(currentDir))
      return
    const entries = readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      if (exclude.some(re => re.test(fullPath)))
        continue
      if (entry.isDirectory()) {
        walk(fullPath)
      }
      else if (entry.isFile() && pattern.test(entry.name)) {
        results.push(fullPath)
      }
    }
  }

  walk(dir)
  return results
}

// Check if nuxt config has fonts config (deprecated ogImage.fonts)
async function checkNuxtConfig(rootDir: string): Promise<{
  hasDeprecatedFonts: boolean
  hasNuxtFonts: boolean
  configPath: string | null
}> {
  const configPaths = ['nuxt.config.ts', 'nuxt.config.js', 'nuxt.config.mjs']

  let configPath: string | null = null
  for (const _p of configPaths) {
    const fullPath = join(rootDir, _p)
    if (existsSync(fullPath)) {
      configPath = fullPath
      break
    }
  }

  if (!configPath)
    return { hasDeprecatedFonts: false, hasNuxtFonts: false, configPath: null }

  const mod = await loadFile(configPath).catch(() => null)
  if (!mod)
    return { hasDeprecatedFonts: false, hasNuxtFonts: false, configPath }

  const config = mod.exports.default
  const hasDeprecatedFonts = !!(config?.ogImage?.fonts)
  const modules = config?.modules || []
  const hasNuxtFonts = modules.some((m: string | string[]) =>
    (typeof m === 'string' && m === '@nuxt/fonts')
    || (Array.isArray(m) && m[0] === '@nuxt/fonts'),
  )

  return { hasDeprecatedFonts, hasNuxtFonts, configPath }
}

// Check what migration is needed
interface MigrationCheck {
  needsComponentRename: boolean
  needsFontsMigration: boolean
  needsNuxtFonts: boolean
  componentsToRename: Array<{ from: string, to: string }>
}

async function checkMigrationNeeded(rootDir: string): Promise<MigrationCheck> {
  const result: MigrationCheck = {
    needsComponentRename: false,
    needsFontsMigration: false,
    needsNuxtFonts: false,
    componentsToRename: [],
  }

  // Check components
  const dirs = [rootDir]
  if (existsSync(join(rootDir, 'app')))
    dirs.push(join(rootDir, 'app'))

  const layersDir = join(rootDir, 'layers')
  if (existsSync(layersDir)) {
    const layerDirs = readdirSync(layersDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => join(layersDir, d.name))
    dirs.push(...layerDirs)
  }

  for (const dir of dirs) {
    const components = findOgImageComponents(dir)
    for (const filepath of components) {
      const filename = filepath.split('/').pop()!
      if (!hasRendererSuffix(filename)) {
        result.componentsToRename.push({ from: filepath, to: '' })
      }
    }
  }
  result.needsComponentRename = result.componentsToRename.length > 0

  // Check fonts config
  const configCheck = await checkNuxtConfig(rootDir)
  result.needsFontsMigration = configCheck.hasDeprecatedFonts
  result.needsNuxtFonts = !configCheck.hasNuxtFonts

  return result
}

// Migrate defineOgImage API
function migrateDefineOgImageApi(dryRun: boolean): { changes: Array<{ file: string, count: number }> } {
  const cwd = process.cwd()
  const excludePatterns = [/node_modules/, /\.nuxt/, /\.output/, /dist/]

  const files = globFiles(cwd, /\.(?:vue|ts|tsx|js|jsx)$/, excludePatterns)
  const changes: Array<{ file: string, count: number }> = []

  for (const file of files) {
    let content = readFileSync(file, 'utf-8')
    let modified = false
    let changeCount = 0

    // Pattern 1: defineOgImageComponent → defineOgImage
    if (/defineOgImageComponent\s*\(/.test(content)) {
      content = content.replace(/defineOgImageComponent\s*\(/g, 'defineOgImage(')
      modified = true
      changeCount++
    }

    // Pattern 2: defineOgImage({ ... }) object syntax
    const defineOgImageRegex = /defineOgImage\s*\(\s*(\{[\s\S]*?\})\s*\)/g

    content = content.replace(defineOgImageRegex, (match, inner) => {
      const componentMatch = inner.match(/component\s*:\s*['"]([^'"]+)['"]/)
      const rendererMatch = inner.match(/renderer\s*:\s*['"]([^'"]+)['"]/)
      const propsMatch = inner.match(/props\s*:\s*(\{[^}]*\})/)

      if (!componentMatch && rendererMatch && rendererMatch[1] === 'chromium') {
        const remaining = inner
          .replace(/renderer\s*:\s*['"][^'"]+['"]\s*,?\s*/g, '')
          .replace(/,\s*$/, '')
          .trim()
        modified = true
        changeCount++
        return remaining ? `defineOgImageScreenshot({ ${remaining} })` : `defineOgImageScreenshot()`
      }

      if (componentMatch || rendererMatch) {
        const componentName = componentMatch ? componentMatch[1] : 'NuxtSeo'
        const props = propsMatch ? propsMatch[1] : '{}'

        const otherOptions: string[] = []
        const lines = inner.split(/,(?![^{]*\})/).map((s: string) => s.trim())
        for (const line of lines) {
          if (!line)
            continue
          if (/^component\s*:/.test(line))
            continue
          if (/^props\s*:/.test(line))
            continue
          if (/^renderer\s*:/.test(line))
            continue
          otherOptions.push(line)
        }

        modified = true
        changeCount++

        if (otherOptions.length > 0) {
          return `defineOgImage('${componentName}', ${props}, { ${otherOptions.join(', ')} })`
        }
        return `defineOgImage('${componentName}', ${props})`
      }

      return match
    })

    if (modified) {
      changes.push({ file, count: changeCount })
      if (!dryRun) {
        writeFileSync(file, content, 'utf-8')
      }
    }
  }

  return { changes }
}

// Migrate v6: rename components
function migrateV6Components(
  componentsToRename: Array<{ from: string, to: string }>,
  defaultRenderer: RendererName,
  dryRun: boolean,
): void {
  for (const item of componentsToRename) {
    const filename = item.from.split('/').pop()!
    const newName = filename.replace('.vue', `.${defaultRenderer}.vue`)
    item.to = item.from.replace(filename, newName)
  }

  if (dryRun) {
    console.log('\nWould rename:')
    for (const { from, to } of componentsToRename) {
      console.log(`  ${from.split('/').pop()} → ${to.split('/').pop()}`)
    }
    return
  }

  for (const { from, to } of componentsToRename) {
    renameSync(from, to)
    console.log(`✓ Renamed ${from.split('/').pop()}`)
  }
}

// Install dependencies for renderers
async function installRendererDeps(renderers: RendererName[]): Promise<void> {
  const cwd = process.cwd()
  const pm = await detectPackageManager(cwd)
  const pmName = pm?.name || 'npm'

  const allDeps: string[] = []
  for (const renderer of renderers) {
    const def = RENDERERS.find(r => r.name === renderer)
    if (def) {
      allDeps.push(...def.deps)
    }
  }

  if (allDeps.length === 0)
    return

  const spinner = p.spinner()
  spinner.start(`Installing dependencies with ${pmName}...`)

  for (const dep of allDeps) {
    await addDependency(dep, { cwd, dev: false })
      .catch(() => {
        spinner.stop(`Failed to install ${dep}`)
        p.log.warn(`Run manually: ${pmName} add ${dep}`)
      })
  }

  spinner.stop('Dependencies installed')
}

// Install @nuxt/fonts module using nuxt CLI
async function installNuxtFonts(): Promise<void> {
  const cwd = process.cwd()

  const spinner = p.spinner()
  spinner.start('Adding @nuxt/fonts module...')

  // Use nuxi module add
  const { execa } = await import('execa')
  await execa('npx', ['nuxi', 'module', 'add', '@nuxt/fonts'], { cwd })
    .then(() => {
      spinner.stop('@nuxt/fonts module added')
    })
    .catch(() => {
      spinner.stop('Failed to add @nuxt/fonts')
      p.log.warn('Run manually: npx nuxi module add @nuxt/fonts')
    })
}

// Main migrate command
async function runMigrate(args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run') || args.includes('-d')
  const skipConfirm = args.includes('--yes') || args.includes('-y')

  // Parse --renderer flag for backwards compatibility
  const rendererIdx = args.indexOf('--renderer')
  const cliRenderer = rendererIdx !== -1 ? args[rendererIdx + 1] : null
  if (cliRenderer && !['satori', 'chromium', 'takumi'].includes(cliRenderer)) {
    console.error(`Invalid renderer: ${cliRenderer}. Must be satori, chromium, or takumi.`)
    process.exit(1)
  }

  p.intro('nuxt-og-image v6 Migration')

  const cwd = process.cwd()

  // Check what needs migration
  const migrationCheck = await checkMigrationNeeded(cwd)

  // When components all have suffixes and there's no fonts migration needed
  const noComponentWork = !migrationCheck.needsComponentRename
  const noFontsWork = !migrationCheck.needsFontsMigration && !migrationCheck.needsNuxtFonts

  if (noComponentWork && noFontsWork) {
    console.log('✓ All OG Image components already have renderer suffixes.')
    p.outro('Done')
    return
  }

  // Show what will be migrated
  const tasks: string[] = []
  if (migrationCheck.needsComponentRename) {
    tasks.push(`Rename ${migrationCheck.componentsToRename.length} component(s) to include renderer suffix`)
  }
  if (migrationCheck.needsFontsMigration) {
    tasks.push('Migrate ogImage.fonts to @nuxt/fonts config')
  }
  if (migrationCheck.needsNuxtFonts) {
    tasks.push('Install @nuxt/fonts module')
  }
  tasks.push('Update defineOgImage() calls to new API')

  p.note(tasks.map(t => `• ${t}`).join('\n'), 'Migration tasks')

  if (dryRun) {
    p.log.warn('[Dry run mode - no changes will be made]')
  }

  // If --yes is passed, skip all interactive prompts
  let selectedRenderers: RendererName[]

  if (skipConfirm) {
    // Use --renderer flag if provided, otherwise default to satori
    selectedRenderers = cliRenderer ? [cliRenderer as RendererName] : ['satori']
  }
  else {
    // Interactive mode
    const confirmed = await p.confirm({
      message: 'This will modify files. Continue?',
      initialValue: false,
    })

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('Migration cancelled')
      process.exit(0)
    }

    // Select renderers interactively
    const rendererSelection = await p.multiselect({
      message: 'Which renderers do you want to use?',
      options: RENDERERS.map(r => ({
        value: r.name,
        label: r.label,
        hint: r.description,
      })),
      initialValues: ['satori'],
      required: true,
    })

    if (p.isCancel(rendererSelection)) {
      p.cancel('Migration cancelled')
      process.exit(0)
    }

    selectedRenderers = rendererSelection as RendererName[]

    // Ask about dependency installation
    if (!dryRun) {
      const installDeps = await p.confirm({
        message: 'Install renderer dependencies?',
        initialValue: true,
      })

      if (!p.isCancel(installDeps) && installDeps) {
        await installRendererDeps(selectedRenderers)
      }
    }
  }

  // Rename components
  if (migrationCheck.needsComponentRename) {
    console.log('\nRenaming components...')
    migrateV6Components(migrationCheck.componentsToRename, selectedRenderers[0] || 'satori', dryRun)
  }

  // Migrate API calls
  console.log('\nMigrating defineOgImage calls...')
  const apiChanges = migrateDefineOgImageApi(dryRun)
  if (apiChanges.changes.length > 0) {
    for (const { file, count } of apiChanges.changes) {
      const relPath = file.replace(`${cwd}/`, '')
      console.log(`  ${relPath} (${count} change${count > 1 ? 's' : ''})`)
    }
  }
  else {
    console.log('  No API changes needed')
  }

  // Handle fonts (only in interactive mode)
  if (migrationCheck.needsNuxtFonts && !dryRun && !skipConfirm) {
    const addFonts = await p.confirm({
      message: '@nuxt/fonts is recommended for custom fonts. Add it?',
      initialValue: true,
    })

    if (!p.isCancel(addFonts) && addFonts) {
      await installNuxtFonts()
    }
  }

  if (dryRun) {
    console.log('\n[Dry run - no changes made]')
    console.log('Run without --dry-run to apply changes.')
  }

  p.outro(dryRun ? 'Dry run complete' : 'Migration complete!')
}

// Enable command
async function runEnable(renderer: string): Promise<void> {
  const def = RENDERERS.find(r => r.name === renderer)
  if (!def) {
    p.log.error(`Unknown renderer: ${renderer}`)
    p.log.info(`Available: ${RENDERERS.map(r => r.name).join(', ')}`)
    process.exit(1)
  }

  p.intro(`Enable ${def.label} renderer`)
  await installRendererDeps([renderer as RendererName])
  p.outro('Done')
}

// CLI entry
const args = process.argv.slice(2)
const command = args[0]

if (command === 'eject') {
  const templateName = args[1]
  if (!templateName) {
    p.log.error('Please specify a template name.')
    listTemplates()
    process.exit(1)
  }
  const cwd = process.cwd()
  const targetDir = existsSync(join(cwd, 'app')) ? join(cwd, 'app') : cwd
  ejectTemplate(templateName, targetDir)
}
else if (command === 'list') {
  listTemplates()
}
else if (command === 'migrate') {
  const version = args[1]
  if (version !== 'v6') {
    p.log.error('Usage: npx nuxt-og-image migrate v6 [--dry-run] [--yes] [--renderer <satori|chromium|takumi>]')
    process.exit(1)
  }
  runMigrate(args)
}
else if (command === 'enable') {
  const renderer = args[1]
  if (!renderer) {
    p.log.error('Usage: npx nuxt-og-image enable <renderer>')
    p.log.info(`Available: ${RENDERERS.map(r => r.name).join(', ')}`)
    process.exit(1)
  }
  runEnable(renderer)
}
else {
  console.log('nuxt-og-image CLI\n')
  console.log('Commands:')
  console.log('  list              List available community templates')
  console.log('  eject <name>      Eject a community template to your project')
  console.log('  migrate v6        Migrate to v6 (component suffixes + new API)')
  console.log('                    Options: --dry-run, --yes, --renderer <satori|chromium|takumi>')
  console.log('  enable <renderer> Install dependencies for a renderer (satori, chromium, takumi)')
}
