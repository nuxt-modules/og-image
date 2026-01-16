#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

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

// Glob helper to find files recursively
function globFiles(dir: string, pattern: RegExp, exclude: RegExp[] = []): string[] {
  const results: string[] = []

  function walk(currentDir: string) {
    if (!existsSync(currentDir))
      return
    const entries = readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      // Check exclusions
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

// Migrate defineOgImage API from old object-based to new component-first
function migrateDefineOgImageApi(dryRun: boolean) {
  const cwd = process.cwd()
  const excludePatterns = [
    /node_modules/,
    /\.nuxt/,
    /\.output/,
    /dist/,
  ]

  // Find all Vue and TS files
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
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    const defineOgImageRegex = /defineOgImage\s*\(\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}\s*\)/g

    content = content.replace(defineOgImageRegex, (match, inner) => {
      // Try to parse the object literal
      // Look for component, props, renderer patterns

      // Extract component name
      const componentMatch = inner.match(/component\s*:\s*['"]([^'"]+)['"]/)
      const rendererMatch = inner.match(/renderer\s*:\s*['"]([^'"]+)['"]/)
      const propsMatch = inner.match(/props\s*:\s*(\{[^}]*\})/)

      // If no component and renderer is chromium, convert to screenshot
      if (!componentMatch && rendererMatch && rendererMatch[1] === 'chromium') {
        // Extract remaining options
        const remaining = inner
          .replace(/renderer\s*:\s*['"][^'"]+['"]\s*,?\s*/g, '')
          .replace(/,\s*$/, '')
          .trim()
        modified = true
        changeCount++
        if (remaining) {
          return `defineOgImageScreenshot({ ${remaining} })`
        }
        return `defineOgImageScreenshot()`
      }

      // If has component (or can derive from context)
      if (componentMatch || rendererMatch) {
        const componentName = componentMatch ? componentMatch[1] : 'NuxtSeo'
        const props = propsMatch ? propsMatch[1] : '{}'

        // Extract other options (not component, props, renderer)
        const otherOptions: string[] = []
        const lines = inner.split(/,(?![^{]*\})/).map((s: string) => s.trim())
        for (const line of lines) {
          if (!line)
            continue
          // Skip component, props, renderer
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

      // No match - return original
      return match
    })

    // Pattern 3: Handle array syntax defineOgImage([...])
    // This is more complex - skip for now, handle manually

    if (modified) {
      changes.push({ file, count: changeCount })
      if (!dryRun) {
        writeFileSync(file, content, 'utf-8')
      }
    }
  }

  if (changes.length === 0) {
    console.log('✓ No defineOgImage calls need migration.')
    return
  }

  console.log(`\nFound ${changes.length} file(s) with changes:\n`)
  for (const { file, count } of changes) {
    const relPath = file.replace(`${cwd}/`, '')
    console.log(`  ${relPath} (${count} change${count > 1 ? 's' : ''})`)
  }

  if (dryRun) {
    console.log('\n[Dry run - no changes made]')
    console.log(`\nRun without --dry-run to apply changes.`)
  }
  else {
    console.log(`\n✓ Migration complete. ${changes.length} file(s) updated.`)
  }
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
  const skipConfirm = args.includes('--yes') || args.includes('-y')
  const rendererIdx = args.indexOf('--renderer')
  const renderer = rendererIdx !== -1 ? (args[rendererIdx + 1] || 'satori') : 'satori'
  if (!['satori', 'chromium', 'takumi'].includes(renderer)) {
    console.error(`Invalid renderer: ${renderer}. Must be satori, chromium, or takumi.`)
    process.exit(1)
  }

  console.log('nuxt-og-image v6 Migration\n')
  console.log('This will:')
  console.log('  1. Rename OgImage components to include renderer suffix (.satori.vue, etc.)')
  console.log('  2. Update defineOgImage() calls to new component-first API')
  console.log('')
  console.log('\x1B[33m⚠ WARNING: This modifies files directly and could break your code.\x1B[0m')
  console.log('\x1B[33m  Make sure you have committed or backed up your changes first.\x1B[0m')
  console.log('')

  if (dryRun) {
    console.log('[Dry run mode - no files will be modified]\n')
    migrateV6(true, renderer)
    console.log('')
    migrateDefineOgImageApi(true)
  }
  else if (skipConfirm) {
    migrateV6(false, renderer)
    console.log('')
    migrateDefineOgImageApi(false)
  }
  else {
    confirm('Continue with migration?').then((confirmed) => {
      if (!confirmed) {
        console.log('Migration cancelled.')
        process.exit(0)
      }
      console.log('')
      migrateV6(false, renderer)
      console.log('')
      migrateDefineOgImageApi(false)
    })
  }
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
  console.log('  migrate v6        Migrate to v6 (component suffixes + new API)')
  console.log('                    Options: --dry-run, --renderer <satori|chromium|takumi>')
  console.log('  enable <renderer> Install dependencies for a renderer (satori, chromium, takumi)')
}
