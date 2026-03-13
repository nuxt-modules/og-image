#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import { loadNuxtConfig } from '@nuxt/kit'
import { addDependency, detectPackageManager } from 'nypm'
import { parseAndWalk } from 'oxc-walker'
import { basename, dirname, join, relative, resolve } from 'pathe'
import { migrateDefaultsComponent, migrateFontsConfig } from './migrations/fonts'

const __dirname = dirname(fileURLToPath(import.meta.url))

const communityDir = resolve(__dirname, 'runtime/app/components/Templates/Community')

// Module-scope regex constants
const RE_RENDERER_SUFFIX = /\.(satori|browser|takumi)\.vue$/
const RE_ANY_RENDERER_SUFFIX = /\.(?:satori|browser|takumi|chromium)\.vue$/
const RE_CHROMIUM_SUFFIX = /\.chromium\.vue$/
const RE_ATTR = /:(\w+)="([^"]*)"|(\w+)="([^"]*)"|(\w+)/g
const RE_EXCLUDE_NODE_MODULES = /node_modules/
const RE_EXCLUDE_NUXT = /\.nuxt/
const RE_EXCLUDE_OUTPUT = /\.output/
const RE_EXCLUDE_DATA = /\.data/
const RE_EXCLUDE_DIST = /dist/
const RE_VUE_OR_SCRIPT = /\.(?:vue|ts|tsx|js|jsx)$/
const RE_OG_IMAGE_SCREENSHOT_SELF_CLOSE = /<OgImageScreenshot([^>]*?)\/>/g
const RE_OG_IMAGE_SCREENSHOT_OPEN_CLOSE = /<OgImageScreenshot([^>]*)>[\s\S]*?<\/OgImageScreenshot>/g
const RE_OG_IMAGE_SELF_CLOSE = /<OgImage(?!Screenshot)([^>]*?)\/>/g
const RE_OG_IMAGE_OPEN_CLOSE = /<OgImage(?!Screenshot)([^>]*)>[\s\S]*?<\/OgImage>/g
// Script block extraction for .vue files
const RE_SCRIPT_BLOCK = /<script\b[^>]*>([\s\S]*?)<\/script>/g

// Deprecated composable names that should be renamed to defineOgImage
const DEPRECATED_COMPOSABLE_NAMES = new Set([
  'defineOgImageComponent',
  'defineOgImageStatic',
  'defineOgImageDynamic',
  'defineOgImageCached',
  'defineOgImageWithoutCache',
])

// All composable names that may need migration (including defineOgImage itself for object syntax)
const ALL_OG_IMAGE_COMPOSABLES = new Set([
  'defineOgImage',
  ...DEPRECATED_COMPOSABLE_NAMES,
])

interface AstReplacement {
  start: number
  end: number
  text: string
}

/**
 * Use oxc-walker to collect AST-based replacements for JS/TS code.
 * Handles: composable renames, object syntax migration, import path migration.
 */
function collectScriptReplacements(code: string, filename: string): AstReplacement[] {
  const replacements: AstReplacement[] = []

  parseAndWalk(code, filename, (node: any) => {
    // Import path migrations
    if (node.type === 'ImportDeclaration') {
      const source = node.source
      const sourceValue = source?.value
      if (sourceValue === '#nuxt-og-image-utils') {
        replacements.push({ start: source.start + 1, end: source.end - 1, text: '#og-image/shared' })
      }
      else if (sourceValue === '#og-image/shared') {
        const specifiers = node.specifiers || []
        const hasRuntimeConfig = specifiers.some((s: any) => {
          const imported = s.imported || s.local
          return imported?.name === 'useOgImageRuntimeConfig'
        })
        if (hasRuntimeConfig) {
          replacements.push({ start: source.start + 1, end: source.end - 1, text: '#og-image/app/utils' })
        }
      }
      return
    }

    // CallExpression: composable renames + object syntax migration
    if (node.type !== 'CallExpression')
      return

    const callee = node.callee
    const calleeName: string | undefined = callee?.name
    if (!calleeName || !ALL_OG_IMAGE_COMPOSABLES.has(calleeName))
      return

    const args = node.arguments || []

    // Single object argument → check for url / component / renderer patterns
    if (args.length === 1 && args[0]?.type === 'ObjectExpression') {
      const objArg = args[0]
      const properties = (objArg.properties || []).filter((p: any) =>
        p.type === 'ObjectProperty' || p.type === 'Property',
      )

      const findProp = (name: string) => properties.find((p: any) =>
        p.key?.name === name,
      )

      const urlProp = findProp('url')
      const componentProp = findProp('component')
      const rendererProp = findProp('renderer')
      const propsProp = findProp('props')

      // { url: '...' } → useSeoMeta({ ogImage: url, ... })
      if (urlProp) {
        const urlValue = code.slice(urlProp.value.start, urlProp.value.end)
        // Map known OG properties to useSeoMeta equivalents
        const ogPropMap: Record<string, string> = {
          width: 'ogImageWidth',
          height: 'ogImageHeight',
          alt: 'ogImageAlt',
          type: 'ogImageType',
        }
        const seoMetaProps = [`ogImage: ${urlValue}`]
        for (const prop of properties) {
          if (prop === urlProp)
            continue
          const keyName = prop.key?.name as string
          const mappedName = ogPropMap[keyName]
          if (mappedName) {
            seoMetaProps.push(`${mappedName}: ${code.slice(prop.value.start, prop.value.end)}`)
          }
        }
        const text = `useSeoMeta({ ${seoMetaProps.join(', ')} })`
        replacements.push({ start: node.start, end: node.end, text })
        return
      }

      // { renderer: 'chromium' } (no component) → defineOgImageScreenshot()
      if (!componentProp && rendererProp) {
        const rendererValue = code.slice(rendererProp.value.start, rendererProp.value.end).trim()
        if (rendererValue === '\'chromium\'' || rendererValue === '"chromium"') {
          const otherProps = properties.filter((p: any) => p !== rendererProp)
          const text = otherProps.length > 0
            ? `defineOgImageScreenshot({ ${otherProps.map((p: any) => code.slice(p.start, p.end)).join(', ')} })`
            : `defineOgImageScreenshot()`
          replacements.push({ start: node.start, end: node.end, text })
          return
        }
      }

      // { component: 'Name', props: {...} } → defineOgImage('Name', props, { ...rest })
      if (componentProp || rendererProp) {
        const componentName = componentProp
          ? code.slice(componentProp.value.start, componentProp.value.end)
          : '\'NuxtSeo\''
        const propsValue = propsProp
          ? code.slice(propsProp.value.start, propsProp.value.end)
          : '{}'
        const otherProps = properties.filter((p: any) =>
          p !== componentProp && p !== rendererProp && p !== propsProp,
        )

        const text = otherProps.length > 0
          ? `defineOgImage(${componentName}, ${propsValue}, { ${otherProps.map((p: any) => code.slice(p.start, p.end)).join(', ')} })`
          : `defineOgImage(${componentName}, ${propsValue})`
        replacements.push({ start: node.start, end: node.end, text })
        return
      }
    }

    // Fallback: just rename deprecated composable → defineOgImage
    if (DEPRECATED_COMPOSABLE_NAMES.has(calleeName)) {
      replacements.push({ start: callee.start, end: callee.end, text: 'defineOgImage' })
    }
  })

  return replacements
}

/**
 * Apply collected replacements to source code (reverse order to preserve offsets).
 */
function applyReplacements(code: string, replacements: AstReplacement[]): string {
  const sorted = replacements.toSorted((a, b) => b.start - a.start)
  for (const r of sorted) {
    code = code.slice(0, r.start) + r.text + code.slice(r.end)
  }
  return code
}

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
  return filename.replace(RE_RENDERER_SUFFIX, '')
}

function hasRendererSuffix(filename: string): boolean {
  return RE_ANY_RENDERER_SUFFIX.test(filename)
}

function hasChromiumSuffix(filename: string): boolean {
  return RE_CHROMIUM_SUFFIX.test(filename)
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

// Community template names that must be ejected for production
const COMMUNITY_TEMPLATES = ['NuxtSeo', 'Brutalist', 'SimpleBlog']
const RE_COMMUNITY_TEMPLATE = /defineOgImage\w*\s*\(\s*['"](\w+)['"]/g

// Detect community template usage in source files
function detectCommunityTemplateUsage(rootDir: string): string[] {
  const excludePatterns = [RE_EXCLUDE_NODE_MODULES, RE_EXCLUDE_NUXT, RE_EXCLUDE_OUTPUT, RE_EXCLUDE_DATA, RE_EXCLUDE_DIST]
  const files = globFiles(rootDir, RE_VUE_OR_SCRIPT, excludePatterns)
  const used = new Set<string>()

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    RE_COMMUNITY_TEMPLATE.lastIndex = 0
    for (let m = RE_COMMUNITY_TEMPLATE.exec(content); m !== null; m = RE_COMMUNITY_TEMPLATE.exec(content)) {
      // Match with or without renderer suffix (e.g. 'NuxtSeo' or 'NuxtSeo.takumi')
      const baseName = m[1]?.split('.')[0]
      if (baseName && COMMUNITY_TEMPLATES.includes(baseName)) {
        used.add(baseName)
      }
    }
  }

  return [...used]
}

// Remove deprecated config keys from nuxt.config
async function removeDeprecatedConfigKeys(rootDir: string, keys: Array<{ key: string, replacement: string }>): Promise<{ removed: string[], failed: string[] }> {
  const configPaths = ['nuxt.config.ts', 'nuxt.config.js', 'nuxt.config.mjs']
  let configPath: string | undefined
  for (const cp of configPaths) {
    const fullPath = join(rootDir, cp)
    if (existsSync(fullPath)) {
      configPath = fullPath
      break
    }
  }
  if (!configPath)
    return { removed: [], failed: keys.map(k => k.key) }

  const { loadFile, writeFile } = await import('magicast')
  const mod = await loadFile(configPath)
  const config = mod.exports.default
  const ogImageConfig = config?.ogImage as any
  if (!ogImageConfig)
    return { removed: [], failed: keys.map(k => k.key) }

  const removed: string[] = []
  const failed: string[] = []
  for (const { key } of keys) {
    if (key.includes('.')) {
      // Handle nested keys like 'defaults.renderer'
      const parts = key.split('.')
      let obj = ogImageConfig
      for (let i = 0; i < parts.length - 1; i++) {
        obj = obj?.[parts[i]!]
      }
      if (obj && parts.at(-1)! in obj) {
        delete obj[parts.at(-1)!]
        // Clean up empty parent
        if (Object.keys(obj).length === 0) {
          delete ogImageConfig[parts[0]!]
        }
        removed.push(key)
      }
      else {
        failed.push(key)
      }
    }
    else if (key in ogImageConfig) {
      delete ogImageConfig[key]
      removed.push(key)
    }
    else {
      failed.push(key)
    }
  }

  // Clean up empty ogImage
  if (Object.keys(ogImageConfig).length === 0)
    delete config.ogImage

  await writeFile(mod, configPath)
  return { removed, failed }
}

// Deprecated ogImage config keys and their replacements
const DEPRECATED_CONFIG_KEYS: Record<string, string> = {
  fonts: '@nuxt/fonts module (migrated automatically)',
  strictNuxtContentPaths: 'Removed (no effect in Content v3)',
  playground: 'Removed (use Nuxt DevTools)',
  host: 'site.url or NUXT_SITE_URL',
  siteUrl: 'site.url or NUXT_SITE_URL',
  runtimeBrowser: 'compatibility.runtime.browser',
  runtimeSatori: 'compatibility.runtime.satori',
  cacheTtl: 'cacheMaxAgeSeconds',
  cache: 'cacheMaxAgeSeconds',
  cacheKey: 'Removed',
  static: 'zeroRuntime',
  componentOptions: 'Removed (use defineOgImage())',
}

// Check if nuxt config has deprecated options
async function checkNuxtConfig(rootDir: string): Promise<{
  hasDeprecatedFonts: boolean
  hasNuxtFonts: boolean
  hasDefaultsComponent: boolean
  defaultComponentName: string | null
  nitroPreset: string | null
  deprecatedConfigKeys: Array<{ key: string, replacement: string }>
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
    return { hasDeprecatedFonts: false, hasNuxtFonts: hasNuxtFontsInPkg, hasDefaultsComponent: false, defaultComponentName: null, nitroPreset: null, deprecatedConfigKeys: [] }

  const ogImageConfig = config.ogImage as any
  const hasDeprecatedFonts = !!ogImageConfig?.fonts
  const hasDefaultsComponent = !!ogImageConfig?.defaults?.component
  const defaultComponentName = hasDefaultsComponent ? String(ogImageConfig.defaults.component) : null
  const modules = config.modules || []
  // @ts-expect-error untyped
  const hasNuxtFontsInConfig = modules.some((m: string | string[]) =>
    (typeof m === 'string' && m === '@nuxt/fonts')
    || (Array.isArray(m) && m[0] === '@nuxt/fonts'),
  )
  const nitroPreset = config.nitro?.preset || null

  // Detect deprecated config keys
  const deprecatedConfigKeys: Array<{ key: string, replacement: string }> = []
  if (ogImageConfig) {
    for (const [key, replacement] of Object.entries(DEPRECATED_CONFIG_KEYS)) {
      if (key in ogImageConfig) {
        deprecatedConfigKeys.push({ key, replacement })
      }
    }
    // Check nested defaults.renderer
    if (ogImageConfig.defaults?.renderer) {
      deprecatedConfigKeys.push({ key: 'defaults.renderer', replacement: 'Removed (renderer determined by component filename suffix)' })
    }
  }

  return {
    hasDeprecatedFonts,
    hasNuxtFonts: hasNuxtFontsInPkg || hasNuxtFontsInConfig,
    hasDefaultsComponent,
    defaultComponentName,
    nitroPreset,
    deprecatedConfigKeys,
  }
}

// Check what migration is needed
interface MigrationCheck {
  needsComponentRename: boolean
  needsFontsMigration: boolean
  needsNuxtFonts: boolean
  needsDefaultsComponentMigration: boolean
  defaultComponentName: string | null
  componentsToRename: Array<{ from: string, to: string }>
  deprecatedConfigKeys: Array<{ key: string, replacement: string }>
  usedCommunityTemplates: string[]
}

async function checkMigrationNeeded(rootDir: string): Promise<MigrationCheck> {
  const result: MigrationCheck = {
    needsComponentRename: false,
    needsFontsMigration: false,
    needsNuxtFonts: false,
    needsDefaultsComponentMigration: false,
    defaultComponentName: null,
    componentsToRename: [],
    deprecatedConfigKeys: [],
    usedCommunityTemplates: [],
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

  // Check config
  const configCheck = await checkNuxtConfig(rootDir)
  result.needsFontsMigration = configCheck.hasDeprecatedFonts
  result.needsNuxtFonts = !configCheck.hasNuxtFonts
  result.needsDefaultsComponentMigration = configCheck.hasDefaultsComponent
  result.defaultComponentName = configCheck.defaultComponentName
  // Exclude 'fonts' from deprecated keys since it's handled by needsFontsMigration
  result.deprecatedConfigKeys = configCheck.deprecatedConfigKeys.filter(k => k.key !== 'fonts')

  // Detect community template usage in source files
  result.usedCommunityTemplates = detectCommunityTemplateUsage(rootDir)

  return result
}

// Convert Vue template attrs like `title="Hello" :width="1200"` to a JS object string
function attrsToProps(attrs: string): string {
  if (!attrs)
    return ''
  const props: string[] = []
  // Match :prop="expr" or prop="value" or prop (boolean)
  for (const m of attrs.matchAll(RE_ATTR)) {
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
  const excludePatterns = [RE_EXCLUDE_NODE_MODULES, RE_EXCLUDE_NUXT, RE_EXCLUDE_OUTPUT, RE_EXCLUDE_DATA, RE_EXCLUDE_DIST]

  const files = globFiles(cwd, RE_VUE_OR_SCRIPT, excludePatterns)
  const changes: Array<{ file: string, count: number }> = []

  for (const file of files) {
    let content = readFileSync(file, 'utf-8')

    // Fast-path: skip files without any relevant patterns
    if (
      !content.includes('defineOgImage')
      && !content.includes('OgImage')
      && !content.includes('#nuxt-og-image-utils')
      && !content.includes('useOgImageRuntimeConfig')
    ) {
      continue
    }

    let modified = false
    let changeCount = 0

    // Template component migration (HTML — regex is appropriate here)
    // <OgImageScreenshot /> and <OgImage /> → comments
    content = content.replace(RE_OG_IMAGE_SCREENSHOT_SELF_CLOSE, (_match, attrs: string) => {
      modified = true
      changeCount++
      const propsStr = attrsToProps(attrs.trim())
      return propsStr
        ? `<!-- Migrated: use defineOgImageScreenshot(${propsStr}) in <script setup> -->`
        : `<!-- Migrated: use defineOgImageScreenshot() in <script setup> -->`
    })
    content = content.replace(RE_OG_IMAGE_SCREENSHOT_OPEN_CLOSE, (_match, attrs: string) => {
      modified = true
      changeCount++
      const propsStr = attrsToProps(attrs.trim())
      return propsStr
        ? `<!-- Migrated: use defineOgImageScreenshot(${propsStr}) in <script setup> -->`
        : `<!-- Migrated: use defineOgImageScreenshot() in <script setup> -->`
    })
    content = content.replace(RE_OG_IMAGE_SELF_CLOSE, (_match, attrs: string) => {
      modified = true
      changeCount++
      const propsStr = attrsToProps(attrs.trim())
      return propsStr
        ? `<!-- Migrated: use defineOgImage(${propsStr}) in <script setup> -->`
        : `<!-- Migrated: use defineOgImage() in <script setup> -->`
    })
    content = content.replace(RE_OG_IMAGE_OPEN_CLOSE, (_match, attrs: string) => {
      modified = true
      changeCount++
      const propsStr = attrsToProps(attrs.trim())
      return propsStr
        ? `<!-- Migrated: use defineOgImage(${propsStr}) in <script setup> -->`
        : `<!-- Migrated: use defineOgImage() in <script setup> -->`
    })

    // AST-based JS/TS migrations (composable renames, object syntax, import paths)
    const hasScriptPatterns = content.includes('defineOgImage')
      || content.includes('#nuxt-og-image-utils')
      || content.includes('useOgImageRuntimeConfig')

    if (hasScriptPatterns) {
      if (file.endsWith('.vue')) {
        // Extract and transform each <script> block independently
        RE_SCRIPT_BLOCK.lastIndex = 0
        for (let m = RE_SCRIPT_BLOCK.exec(content); m; m = RE_SCRIPT_BLOCK.exec(content)) {
          const scriptContent = m[1]!
          const scriptOffset = m.index + m[0].indexOf(scriptContent)

          const replacements = collectScriptReplacements(scriptContent, file)
          if (replacements.length > 0) {
            // Adjust positions to full-file offsets
            const adjusted = replacements.map(r => ({
              start: r.start + scriptOffset,
              end: r.end + scriptOffset,
              text: r.text,
            }))
            content = applyReplacements(content, adjusted)
            modified = true
            changeCount += replacements.length
            // Reset regex since content changed
            RE_SCRIPT_BLOCK.lastIndex = 0
          }
        }
      }
      else {
        const replacements = collectScriptReplacements(content, file)
        if (replacements.length > 0) {
          content = applyReplacements(content, replacements)
          modified = true
          changeCount += replacements.length
        }
      }
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

  // When nothing needs migration
  const noComponentWork = !migrationCheck.needsComponentRename
  const noFontsWork = !migrationCheck.needsFontsMigration && !migrationCheck.needsNuxtFonts
  const noDefaultsWork = !migrationCheck.needsDefaultsComponentMigration
  const noConfigWork = migrationCheck.deprecatedConfigKeys.length === 0
  const noCommunityWork = migrationCheck.usedCommunityTemplates.length === 0

  if (noComponentWork && noFontsWork && noDefaultsWork && noConfigWork && noCommunityWork) {
    console.log('✓ All OG Image components already have renderer suffixes.')
    p.outro('Done')
    return
  }

  // Show what will be migrated
  const tasks: string[] = []
  if (migrationCheck.needsComponentRename) {
    tasks.push(`Rename ${migrationCheck.componentsToRename.length} component(s) to include renderer suffix`)
  }
  if (migrationCheck.needsDefaultsComponentMigration) {
    tasks.push(`Remove deprecated defaults.component: '${migrationCheck.defaultComponentName}'`)
  }
  if (migrationCheck.deprecatedConfigKeys.length > 0) {
    tasks.push(`Remove ${migrationCheck.deprecatedConfigKeys.length} deprecated config option(s): ${migrationCheck.deprecatedConfigKeys.map(k => k.key).join(', ')}`)
  }
  if (migrationCheck.needsFontsMigration) {
    tasks.push('Migrate ogImage.fonts to @nuxt/fonts config')
  }
  if (migrationCheck.needsNuxtFonts) {
    tasks.push('Install @nuxt/fonts module')
  }
  if (migrationCheck.usedCommunityTemplates.length > 0) {
    tasks.push(`Eject community templates: ${migrationCheck.usedCommunityTemplates.join(', ')}`)
  }
  tasks.push('Migrate deprecated composables (defineOgImageStatic, etc.) to defineOgImage()')
  tasks.push('Migrate <OgImage> and <OgImageScreenshot> components to composables')
  tasks.push('Migrate defineOgImage({ url }) to useSeoMeta({ ogImage })')
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

  // Migrate defaults.component
  if (migrationCheck.needsDefaultsComponentMigration) {
    if (dryRun) {
      p.log.info(`Would remove defaults.component: '${migrationCheck.defaultComponentName}'`)
    }
    else {
      const result = await migrateDefaultsComponent(cwd).catch((err) => {
        p.log.warn(`Failed to migrate defaults.component: ${err.message}`)
        return { migrated: false, componentName: null, message: err.message }
      })
      if (result.migrated) {
        p.log.success(`Removed defaults.component: '${result.componentName}'`)
        p.log.info(`  To use '${result.componentName}' as default, rename it to OgImage/Default.{renderer}.vue`)
      }
    }
  }

  // Migrate fonts config
  if (migrationCheck.needsFontsMigration) {
    if (dryRun) {
      p.log.info('Would migrate ogImage.fonts to @nuxt/fonts config')
    }
    else {
      const result = await migrateFontsConfig(cwd).catch((err) => {
        p.log.warn(`Failed to migrate fonts config: ${err.message}`)
        return { migrated: false, message: err.message }
      })
      if (result.migrated) {
        p.log.success(result.message)
      }
      else {
        p.log.warn(`Fonts migration: ${result.message}`)
      }
    }
  }

  // Remove deprecated config options
  if (migrationCheck.deprecatedConfigKeys.length > 0) {
    if (dryRun) {
      p.log.info('Would remove deprecated config options:')
      for (const { key, replacement } of migrationCheck.deprecatedConfigKeys) {
        p.log.info(`  • ogImage.${key} → ${replacement}`)
      }
    }
    else {
      const result = await removeDeprecatedConfigKeys(cwd, migrationCheck.deprecatedConfigKeys).catch((err) => {
        p.log.warn(`Failed to remove deprecated config: ${(err as Error).message}`)
        return { removed: [] as string[], failed: migrationCheck.deprecatedConfigKeys.map(k => k.key) }
      })
      if (result.removed.length > 0) {
        p.log.success(`Removed deprecated config: ${result.removed.map(k => `ogImage.${k}`).join(', ')}`)
      }
      for (const key of result.failed) {
        const replacement = migrationCheck.deprecatedConfigKeys.find(k => k.key === key)?.replacement
        if (replacement) {
          p.log.warn(`  Could not remove ogImage.${key} — manually replace with: ${replacement}`)
        }
      }
    }
  }

  // Warn about community templates that need ejection
  if (migrationCheck.usedCommunityTemplates.length > 0) {
    p.log.warn('Community templates detected that must be ejected for production:')
    for (const name of migrationCheck.usedCommunityTemplates) {
      p.log.warn(`  • ${name}`)
    }
    if (!dryRun) {
      const shouldEject = skipConfirm || await p.confirm({
        message: 'Eject community templates now?',
        initialValue: true,
      }).then(v => !p.isCancel(v) && v)

      if (shouldEject) {
        const targetDir = existsSync(join(cwd, 'app')) ? join(cwd, 'app') : cwd
        for (const name of migrationCheck.usedCommunityTemplates) {
          ejectTemplate(name, targetDir)
        }
      }
      else {
        p.log.info('Run manually before building for production:')
        for (const name of migrationCheck.usedCommunityTemplates) {
          p.log.info(`  npx nuxt-og-image eject ${name}`)
        }
      }
    }
  }

  // Offer @nuxt/fonts installation
  if (migrationCheck.needsNuxtFonts && !dryRun) {
    if (skipConfirm) {
      await installNuxtFonts()
    }
    else {
      const addFonts = await p.confirm({
        message: '@nuxt/fonts is recommended for font management. Install it?',
        initialValue: true,
      })

      if (!p.isCancel(addFonts) && addFonts) {
        await installNuxtFonts()
      }
      else {
        p.log.info('Skipped @nuxt/fonts installation. Add manually: npx nuxi module add @nuxt/fonts')
      }
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
