#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import { loadNuxtConfig } from '@nuxt/kit'
import { addDependency, detectPackageManager } from 'nypm'
import { basename, dirname, join, relative, resolve } from 'pathe'

const __dirname = dirname(fileURLToPath(import.meta.url))

const communityDir = resolve(__dirname, 'runtime/app/components/Templates/Community')

// Default component directories (must match module.ts)
const defaultComponentDirs = ['OgImage', 'OgImageCommunity', 'og-image', 'OgImageTemplate']

// Renderer definitions with descriptions
const RENDERERS = [
  {
    name: 'takumi',
    label: 'Takumi (Recommended)',
    description: '2-10x faster, comprehensive CSS support',
  },
  {
    name: 'satori',
    label: 'Satori',
    description: 'SVG-based renderer - works without extra dependencies',
  },
  {
    name: 'browser',
    label: 'Browser',
    description: 'Full CSS via screenshots - prerender only',
  },
] as const

type RendererName = typeof RENDERERS[number]['name']

// Deployment targets that need wasm bindings
const EDGE_PRESETS = ['cloudflare', 'cloudflare-pages', 'cloudflare-module', 'vercel-edge', 'netlify-edge']

// Get dependencies based on renderer and deployment target
// Edge targets need both node (for local dev) and wasm (for production) versions
function getRendererDeps(renderer: RendererName, isEdge: boolean): string[] {
  switch (renderer) {
    case 'satori':
      return isEdge
        ? ['satori', '@resvg/resvg-js', '@resvg/resvg-wasm']
        : ['satori', '@resvg/resvg-js']
    case 'takumi':
      return isEdge
        ? ['@takumi-rs/core', '@takumi-rs/wasm']
        : ['@takumi-rs/core']
    case 'browser':
      // browser not supported on edge
      return isEdge ? [] : ['playwright-core']
  }
}

// Template files are named like "NuxtSeo.satori.vue"
function getBaseName(filename: string): string {
  return filename.replace(/\.(satori|browser|takumi)\.vue$/, '')
}

function hasRendererSuffix(filename: string): boolean {
  return /\.(?:satori|browser|takumi|chromium)\.vue$/.test(filename)
}

function hasChromiumSuffix(filename: string): boolean {
  return /\.chromium\.vue$/.test(filename)
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
  nitroPreset: string | null
}> {
  // Check package.json for @nuxt/fonts
  let hasNuxtFontsInPkg = false
  const pkgPath = join(rootDir, 'package.json')
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    hasNuxtFontsInPkg = !!(pkg.dependencies?.['@nuxt/fonts'] || pkg.devDependencies?.['@nuxt/fonts'])
  }

  const config = await loadNuxtConfig({ cwd: rootDir }).catch(() => null)
  if (!config)
    return { hasDeprecatedFonts: false, hasNuxtFonts: hasNuxtFontsInPkg, nitroPreset: null }

  const hasDeprecatedFonts = !!(config.ogImage as any)?.fonts
  const modules = config.modules || []
  // @ts-expect-error untyped
  const hasNuxtFontsInConfig = modules.some((m: string | string[]) =>
    (typeof m === 'string' && m === '@nuxt/fonts')
    || (Array.isArray(m) && m[0] === '@nuxt/fonts'),
  )
  const nitroPreset = config.nitro?.preset || null

  return {
    hasDeprecatedFonts,
    hasNuxtFonts: hasNuxtFontsInPkg || hasNuxtFontsInConfig,
    nitroPreset,
  }
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
      const filename = basename(filepath)
      if (hasChromiumSuffix(filename)) {
        // .chromium.vue → .browser.vue
        result.componentsToRename.push({ from: filepath, to: filepath.replace('.chromium.vue', '.browser.vue') })
      }
      else if (!hasRendererSuffix(filename)) {
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

// Convert Vue template attrs like `title="Hello" :width="1200"` to a JS object string
function attrsToProps(attrs: string): string {
  if (!attrs)
    return ''
  const props: string[] = []
  // Match :prop="expr" or prop="value" or prop (boolean)
  const attrRegex = /:(\w+)="([^"]*)"|(\w+)="([^"]*)"|(\w+)/g
  for (const m of attrs.matchAll(attrRegex)) {
    if (m[1]) // dynamic :prop="expr"
      props.push(`${m[1]}: ${m[2]}`)
    else if (m[3]) // static prop="value"
      props.push(`${m[3]}: '${m[4]}'`)
    else if (m[5]) // boolean prop
      props.push(`${m[5]}: true`)
  }
  return props.length ? `{ ${props.join(', ')} }` : ''
}

// Migrate defineOgImage API
function migrateDefineOgImageApi(dryRun: boolean): { changes: Array<{ file: string, count: number }> } {
  const cwd = process.cwd()
  const excludePatterns = [/node_modules/, /\.nuxt/, /\.output/, /\.data/, /dist/]

  const files = globFiles(cwd, /\.(?:vue|ts|tsx|js|jsx)$/, excludePatterns)
  const changes: Array<{ file: string, count: number }> = []

  for (const file of files) {
    let content = readFileSync(file, 'utf-8')
    let modified = false
    let changeCount = 0

    // Pattern 0: <OgImageScreenshot /> and <OgImage /> component usage → composable
    // Handles self-closing and open/close tags, with or without props
    content = content.replace(/<OgImageScreenshot([^>]*?)\/>/g, (_match, attrs: string) => {
      modified = true
      changeCount++
      const propsStr = attrsToProps(attrs.trim())
      return propsStr
        ? `<!-- Migrated: use defineOgImageScreenshot(${propsStr}) in <script setup> -->`
        : `<!-- Migrated: use defineOgImageScreenshot() in <script setup> -->`
    })
    content = content.replace(/<OgImageScreenshot([^>]*)>[\s\S]*?<\/OgImageScreenshot>/g, (_match, attrs: string) => {
      modified = true
      changeCount++
      const propsStr = attrsToProps(attrs.trim())
      return propsStr
        ? `<!-- Migrated: use defineOgImageScreenshot(${propsStr}) in <script setup> -->`
        : `<!-- Migrated: use defineOgImageScreenshot() in <script setup> -->`
    })
    // OgImage but not OgImageScreenshot (use word boundary via negative lookahead)
    content = content.replace(/<OgImage(?!Screenshot)([^>]*?)\/>/g, (_match, attrs: string) => {
      modified = true
      changeCount++
      const propsStr = attrsToProps(attrs.trim())
      return propsStr
        ? `<!-- Migrated: use defineOgImage(${propsStr}) in <script setup> -->`
        : `<!-- Migrated: use defineOgImage() in <script setup> -->`
    })
    content = content.replace(/<OgImage(?!Screenshot)([^>]*)>[\s\S]*?<\/OgImage>/g, (_match, attrs: string) => {
      modified = true
      changeCount++
      const propsStr = attrsToProps(attrs.trim())
      return propsStr
        ? `<!-- Migrated: use defineOgImage(${propsStr}) in <script setup> -->`
        : `<!-- Migrated: use defineOgImage() in <script setup> -->`
    })

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
          .replace(/^\{\s*\}$/, '') // strip empty braces
          .trim()
        modified = true
        changeCount++
        return remaining ? `defineOgImageScreenshot(${remaining})` : `defineOgImageScreenshot()`
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

    // Pattern 3: Import path migrations
    if (content.includes('#nuxt-og-image-utils')) {
      content = content.replace(/#nuxt-og-image-utils/g, '#og-image/shared')
      modified = true
      changeCount++
    }
    if (/import\s*\{[^}]*useOgImageRuntimeConfig[^}]*\}\s*from\s*['"]#og-image\/shared['"]/.test(content)) {
      content = content.replace(
        /(import\s*\{[^}]*useOgImageRuntimeConfig[^}]*\}\s*from\s*['"])#og-image\/shared(['"])/g,
        '$1#og-image/app/utils$2',
      )
      modified = true
      changeCount++
    }

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
    if (item.to)
      continue // already set (e.g. .chromium.vue → .browser.vue)
    const filename = basename(item.from)
    const newName = filename.replace('.vue', `.${defaultRenderer}.vue`)
    item.to = join(dirname(item.from), newName)
  }

  if (dryRun) {
    console.log('\nWould rename:')
    for (const { from, to } of componentsToRename) {
      console.log(`  ${basename(from)} → ${basename(to)}`)
    }
    return
  }

  for (const { from, to } of componentsToRename) {
    renameSync(from, to)
    console.log(`✓ Renamed ${basename(from)}`)
  }
}

// Detect deployment target from nuxt.config
async function detectDeploymentTarget(rootDir: string): Promise<string | null> {
  const config = await loadNuxtConfig({ cwd: rootDir }).catch(() => null)
  return config?.nitro?.preset || null
}

// Install dependencies for renderers
async function installRendererDeps(renderers: RendererName[], isEdge: boolean): Promise<void> {
  const cwd = process.cwd()
  const pm = await detectPackageManager(cwd)
  const pmName = pm?.name || 'npm'

  const allDeps: string[] = []
  for (const renderer of renderers) {
    allDeps.push(...getRendererDeps(renderer, isEdge))
  }

  // Dedupe
  const uniqueDeps = [...new Set(allDeps)]

  if (uniqueDeps.length === 0)
    return

  const spinner = p.spinner()
  spinner.start(`Installing dependencies with ${pmName}...`)

  for (const dep of uniqueDeps) {
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
  const { exec } = await import('tinyexec')
  try {
    await exec('npx', ['nuxi', 'module', 'add', '@nuxt/fonts'], { nodeOptions: { cwd } })
    spinner.stop('@nuxt/fonts module added')
  }
  catch {
    spinner.stop('Failed to add @nuxt/fonts')
    p.log.warn('Run manually: npx nuxi module add @nuxt/fonts')
  }
}

// Main migrate command
async function runMigrate(args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run') || args.includes('-d')
  const skipConfirm = args.includes('--yes') || args.includes('-y')

  // Parse --renderer flag for backwards compatibility
  const rendererIdx = args.indexOf('--renderer')
  const cliRenderer = rendererIdx !== -1 ? args[rendererIdx + 1] : null
  if (cliRenderer && !['satori', 'browser', 'takumi'].includes(cliRenderer)) {
    console.error(`Invalid renderer: ${cliRenderer}. Must be satori, browser, or takumi.`)
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
  tasks.push('Migrate <OgImage> and <OgImageScreenshot> components to composables')
  tasks.push('Update defineOgImage() calls to new API')

  p.note(tasks.map(t => `• ${t}`).join('\n'), 'Migration tasks')

  if (dryRun) {
    p.log.warn('[Dry run mode - no changes will be made]')
  }

  // If --yes is passed, skip all interactive prompts
  let selectedRenderers: RendererName[]

  if (skipConfirm) {
    // Use --renderer flag if provided, otherwise default to takumi
    selectedRenderers = cliRenderer ? [cliRenderer as RendererName] : ['takumi']
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
      initialValues: ['takumi'],
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
        // Detect or ask about deployment target
        const detectedPreset = await detectDeploymentTarget(cwd)
        let isEdge = detectedPreset ? EDGE_PRESETS.includes(detectedPreset) : false

        if (detectedPreset) {
          p.log.info(`Detected deployment target: ${detectedPreset}`)
        }
        else {
          const targetSelection = await p.select({
            message: 'What is your deployment target?',
            options: [
              { value: 'node', label: 'Node.js', hint: 'node-server, vercel, netlify, aws-lambda, etc.' },
              { value: 'edge', label: 'Edge/Workers', hint: 'cloudflare, vercel-edge, netlify-edge' },
            ],
            initialValue: 'node',
          })
          if (!p.isCancel(targetSelection)) {
            isEdge = targetSelection === 'edge'
          }
        }

        // Warn if browser selected with edge
        if (isEdge && selectedRenderers.includes('browser')) {
          p.log.warn('Browser renderer is not supported on edge runtimes - skipping its dependencies')
        }

        await installRendererDeps(selectedRenderers, isEdge)
      }
    }
  }

  // Rename components
  if (migrationCheck.needsComponentRename) {
    console.log('\nRenaming components...')
    migrateV6Components(migrationCheck.componentsToRename, selectedRenderers[0] || 'takumi', dryRun)
  }

  // Migrate API calls
  console.log('\nMigrating defineOgImage calls...')
  const apiChanges = migrateDefineOgImageApi(dryRun)
  if (apiChanges.changes.length > 0) {
    for (const { file, count } of apiChanges.changes) {
      const relPath = relative(cwd, file)
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
  else {
    const spinner = p.spinner()
    spinner.start('Running nuxt prepare to update types...')
    const { exec } = await import('tinyexec')
    try {
      await exec('npx', ['nuxi', 'prepare'], { nodeOptions: { cwd } })
      spinner.stop('Types updated')
    }
    catch {
      spinner.stop('Failed to run nuxt prepare')
      p.log.warn('Run manually: npx nuxt prepare')
    }
  }

  p.outro(dryRun ? 'Dry run complete' : 'Migration complete!')
}

// Enable command
async function runEnable(renderer: string, args: string[]): Promise<void> {
  const def = RENDERERS.find(r => r.name === renderer)
  if (!def) {
    p.log.error(`Unknown renderer: ${renderer}`)
    p.log.info(`Available: ${RENDERERS.map(r => r.name).join(', ')}`)
    process.exit(1)
  }

  p.intro(`Enable ${def.label} renderer`)

  const cwd = process.cwd()

  // Check for --edge flag or detect from config
  let isEdge = args.includes('--edge')
  if (!isEdge) {
    const detectedPreset = await detectDeploymentTarget(cwd)
    if (detectedPreset) {
      isEdge = EDGE_PRESETS.includes(detectedPreset)
      if (isEdge)
        p.log.info(`Detected edge deployment target: ${detectedPreset}`)
    }
  }

  if (isEdge && renderer === 'browser') {
    p.log.error('Browser renderer is not supported on edge runtimes')
    process.exit(1)
  }

  await installRendererDeps([renderer as RendererName], isEdge)
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
    p.log.error('Usage: npx nuxt-og-image migrate v6 [--dry-run] [--yes] [--renderer <satori|browser|takumi>]')
    process.exit(1)
  }
  runMigrate(args)
}
else if (command === 'enable') {
  const renderer = args[1]
  if (!renderer) {
    p.log.error('Usage: npx nuxt-og-image enable <renderer> [--edge]')
    p.log.info(`Available: ${RENDERERS.map(r => r.name).join(', ')}`)
    process.exit(1)
  }
  runEnable(renderer, args)
}
else {
  console.log('nuxt-og-image CLI\n')
  console.log('Commands:')
  console.log('  list              List available community templates')
  console.log('  eject <name>      Eject a community template to your project')
  console.log('  migrate v6        Migrate to v6 (component suffixes + new API)')
  console.log('                    Options: --dry-run, --yes, --renderer <satori|browser|takumi>')
  console.log('  enable <renderer> Install dependencies for a renderer (satori, browser, takumi)')
  console.log('                    Options: --edge (install wasm versions for edge runtimes)')
}
