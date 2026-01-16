#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const communityDir = resolve(__dirname, 'runtime/app/components/Templates/Community')

// Renderer dependencies
const RENDERER_DEPS: Record<string, string[]> = {
  satori: ['satori', '@resvg/resvg-js'],
  chromium: ['playwright-core'],
  takumi: ['@aspect-build/aspect', 'linkedom'],
}

// Template files are named like "NuxtSeo.satori.vue"
// We extract the base name (NuxtSeo) for display and user input
function getBaseName(filename: string): string {
  return filename.replace(/\.(satori|chromium|takumi)\.vue$/, '')
}

function hasRendererSuffix(filename: string): boolean {
  return /\.(satori|chromium|takumi)\.vue$/.test(filename)
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
  // Find a file that matches the base name
  const match = files.find(f => getBaseName(f) === name)
  return match || null
}

function ejectTemplate(name: string, targetDir: string) {
  const templateFile = findTemplateFile(name)
  if (!templateFile) {
    console.error(`Template "${name}" not found.`)
    listTemplates()
    process.exit(1)
  }

  const templatePath = join(communityDir, templateFile)
  const outputDir = resolve(targetDir, 'components', 'OgImage')
  if (!existsSync(outputDir))
    mkdirSync(outputDir, { recursive: true })

  // Output file keeps the renderer suffix (e.g., NuxtSeo.satori.vue)
  const outputPath = join(outputDir, templateFile)
  if (existsSync(outputPath)) {
    console.error(`File already exists: ${outputPath}`)
    process.exit(1)
  }

  const content = readFileSync(templatePath, 'utf-8')
  writeFileSync(outputPath, content, 'utf-8')
  console.log(`✓ Ejected "${name}" to ${outputPath}`)
}

// Find OgImage components in a directory
function findOgImageComponents(dir: string): string[] {
  const components: string[] = []
  const ogImageDir = join(dir, 'components', 'OgImage')

  if (existsSync(ogImageDir)) {
    const files = readdirSync(ogImageDir, { withFileTypes: true })
    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.vue'))
        components.push(join(ogImageDir, file.name))
    }
  }

  return components
}

// Migrate v6: rename components to include renderer suffix
function migrateV6(dryRun: boolean, defaultRenderer = 'satori') {
  const cwd = process.cwd()
  const dirs = [cwd]

  // Check for app/ directory (Nuxt v4 structure)
  if (existsSync(join(cwd, 'app')))
    dirs.push(join(cwd, 'app'))

  const toRename: Array<{ from: string, to: string }> = []

  for (const dir of dirs) {
    const components = findOgImageComponents(dir)
    for (const filepath of components) {
      const filename = filepath.split('/').pop()!
      if (!hasRendererSuffix(filename)) {
        const newName = filename.replace('.vue', `.${defaultRenderer}.vue`)
        toRename.push({
          from: filepath,
          to: filepath.replace(filename, newName),
        })
      }
    }
  }

  if (toRename.length === 0) {
    console.log('✓ All OG Image components already have renderer suffixes.')
    return
  }

  console.log(`\nFound ${toRename.length} component(s) to rename:\n`)
  for (const { from, to } of toRename) {
    const fromName = from.split('/').pop()
    const toName = to.split('/').pop()
    console.log(`  ${fromName} → ${toName}`)
  }

  if (dryRun) {
    console.log('\n[Dry run - no changes made]')
    console.log(`\nRun without --dry-run to apply changes.`)
    return
  }

  console.log('')
  for (const { from, to } of toRename) {
    renameSync(from, to)
    console.log(`✓ Renamed ${from.split('/').pop()}`)
  }

  console.log(`\n✓ Migration complete. ${toRename.length} file(s) renamed.`)
}

// Enable a renderer by installing its dependencies
function enableRenderer(renderer: string) {
  const deps = RENDERER_DEPS[renderer]
  if (!deps) {
    console.error(`Unknown renderer: ${renderer}`)
    console.log('Available renderers: satori, chromium, takumi')
    process.exit(1)
  }

  console.log(`Installing dependencies for ${renderer} renderer:`)
  console.log(`  ${deps.join(', ')}\n`)

  // Detect package manager
  const cwd = process.cwd()
  let pm = 'npm'
  if (existsSync(join(cwd, 'pnpm-lock.yaml')))
    pm = 'pnpm'
  else if (existsSync(join(cwd, 'yarn.lock')))
    pm = 'yarn'
  else if (existsSync(join(cwd, 'bun.lockb')))
    pm = 'bun'

  const installCmd = pm === 'npm' ? `${pm} install` : `${pm} add`
  const cmd = `${installCmd} ${deps.join(' ')}`

  console.log(`Running: ${cmd}\n`)
  execSync(cmd, { stdio: 'inherit', cwd })

  console.log(`\n✓ ${renderer} renderer enabled.`)
}

const args = process.argv.slice(2)
const command = args[0]

if (command === 'eject') {
  const templateName = args[1]
  if (!templateName) {
    console.error('Please specify a template name.')
    listTemplates()
    process.exit(1)
  }
  // Try to detect srcDir - check for app/ directory (Nuxt v4 structure)
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
    console.error('Usage: npx nuxt-og-image migrate v6 [--dry-run] [--renderer <satori|chromium|takumi>]')
    process.exit(1)
  }
  const dryRun = args.includes('--dry-run') || args.includes('-d')
  const rendererIdx = args.indexOf('--renderer')
  const renderer = rendererIdx !== -1 ? args[rendererIdx + 1] : 'satori'
  if (!['satori', 'chromium', 'takumi'].includes(renderer)) {
    console.error(`Invalid renderer: ${renderer}. Must be satori, chromium, or takumi.`)
    process.exit(1)
  }
  migrateV6(dryRun, renderer)
}
else if (command === 'enable') {
  const renderer = args[1]
  if (!renderer) {
    console.error('Usage: npx nuxt-og-image enable <renderer>')
    console.log('Available renderers: satori, chromium, takumi')
    process.exit(1)
  }
  enableRenderer(renderer)
}
else {
  console.log('nuxt-og-image CLI\n')
  console.log('Commands:')
  console.log('  list              List available community templates')
  console.log('  eject <name>      Eject a community template to your project')
  console.log('  migrate v6        Rename components to include renderer suffix')
  console.log('                    Options: --dry-run, --renderer <satori|chromium|takumi>')
  console.log('  enable <renderer> Install dependencies for a renderer (satori, chromium, takumi)')
}
