import { existsSync } from 'node:fs'
import { loadFile, writeFile } from 'magicast'
import { addNuxtModule } from 'magicast/helpers'
import { join } from 'pathe'
import { logger } from '../runtime/logger'

interface ParsedFont {
  name: string
  weights: number[]
  styles: ('normal' | 'italic')[]
}

// Parse font strings like 'Inter:400', 'Inter:ital:700'
function parseFontString(font: string): { name: string, weight: number, style: 'normal' | 'italic' } {
  const parts = font.split(':')
  if (parts.length === 3) {
    // Format: 'Inter:ital:700'
    return {
      name: parts[0] || font,
      style: parts[1] === 'ital' ? 'italic' : 'normal',
      weight: Number.parseInt(parts[2] || '') || 400,
    }
  }
  // Format: 'Inter:400' or 'Inter'
  return {
    name: parts[0] || font,
    weight: Number.parseInt(parts[1] || '') || 400,
    style: 'normal',
  }
}

// Group fonts by family name
function groupFontsByFamily(fonts: string[]): ParsedFont[] {
  const families = new Map<string, { weights: Set<number>, styles: Set<'normal' | 'italic'> }>()

  for (const font of fonts) {
    const parsed = parseFontString(font)
    const existing = families.get(parsed.name)
    if (existing) {
      existing.weights.add(parsed.weight)
      existing.styles.add(parsed.style)
    }
    else {
      families.set(parsed.name, {
        weights: new Set([parsed.weight]),
        styles: new Set([parsed.style]),
      })
    }
  }

  return Array.from(families.entries()).map(([name, { weights, styles }]) => ({
    name,
    weights: Array.from(weights).sort((a, b) => a - b),
    styles: Array.from(styles),
  }))
}

export async function migrateFontsConfig(rootDir: string): Promise<{ migrated: boolean, message: string }> {
  const configPaths = [
    'nuxt.config.ts',
    'nuxt.config.js',
    'nuxt.config.mjs',
  ]

  let configPath: string | undefined
  for (const p of configPaths) {
    const fullPath = join(rootDir, p)
    if (existsSync(fullPath)) {
      configPath = fullPath
      break
    }
  }

  if (!configPath) {
    return { migrated: false, message: 'No nuxt.config found' }
  }

  const mod = await loadFile(configPath)
  const config = mod.exports.default

  // Check if ogImage.fonts exists
  if (!config?.ogImage?.fonts) {
    return { migrated: false, message: 'No ogImage.fonts config found' }
  }

  const oldFonts = config.ogImage.fonts
  if (!Array.isArray(oldFonts) || oldFonts.length === 0) {
    return { migrated: false, message: 'ogImage.fonts is empty or invalid' }
  }

  // Parse and group fonts
  const groupedFonts = groupFontsByFamily(oldFonts as string[])

  // Get or create fonts config
  if (!config.fonts) {
    config.fonts = {}
  }
  if (!config.fonts.families) {
    config.fonts.families = []
  }

  // Merge with existing fonts.families
  const existingFamilies = config.fonts.families as Array<{ name: string, weights?: number[], styles?: string[], global?: boolean }>

  for (const font of groupedFonts) {
    const existing = existingFamilies.find((f: { name: string }) => f.name === font.name)
    if (existing) {
      // Merge weights
      const existingWeights = new Set(existing.weights || [])
      for (const w of font.weights) {
        existingWeights.add(w)
      }
      existing.weights = Array.from(existingWeights).sort((a, b) => a - b)

      // Merge styles if not just 'normal'
      if (font.styles.includes('italic')) {
        const existingStyles = new Set(existing.styles || ['normal'])
        existingStyles.add('italic')
        existing.styles = Array.from(existingStyles) as string[]
      }
    }
    else {
      // Add new family
      const family: { name: string, weights: number[], styles?: string[] } = {
        name: font.name,
        weights: font.weights,
      }
      if (font.styles.includes('italic')) {
        family.styles = font.styles
      }
      existingFamilies.push(family)
    }
  }

  // Add @nuxt/fonts module if not present
  addNuxtModule(mod, '@nuxt/fonts')

  // Remove ogImage.fonts
  delete config.ogImage.fonts

  // Clean up empty ogImage object
  if (Object.keys(config.ogImage).length === 0) {
    delete config.ogImage
  }

  // Write the updated config
  await writeFile(mod, configPath)

  const familyNames = groupedFonts.map(f => f.name).join(', ')
  return {
    migrated: true,
    message: `Migrated fonts (${familyNames}) from ogImage.fonts to @nuxt/fonts`,
  }
}

export async function promptFontsMigration(rootDir: string): Promise<void> {
  logger.info('')
  logger.info('Detected deprecated ogImage.fonts configuration.')
  logger.info('')
  logger.info('Inter fonts now work out of the box without any configuration.')
  logger.info('For custom fonts, use @nuxt/fonts:')
  logger.info('')
  logger.info('Before:')
  logger.info('  ogImage: {')
  logger.info('    fonts: [\'Inter:400\', \'Inter:700\']')
  logger.info('  }')
  logger.info('')
  logger.info('After (Inter only): Remove the config entirely — it works by default.')
  logger.info('')
  logger.info('After (custom fonts):')
  logger.info('  modules: [\'@nuxt/fonts\', \'nuxt-og-image\'],')
  logger.info('  fonts: {')
  logger.info('    families: [')
  logger.info('      { name: \'Roboto\', weights: [400, 700] }')
  logger.info('    ]')
  logger.info('  }')
  logger.info('')

  const migrate = await logger.prompt('Automatically migrate nuxt.config?', {
    type: 'confirm',
    initial: true,
  })

  if (migrate) {
    const result = await migrateFontsConfig(rootDir).catch((err) => {
      logger.error(`Migration failed: ${err.message}`)
      return { migrated: false, message: err.message }
    })

    if (result.migrated) {
      logger.success(result.message)
      logger.info('')
      logger.info('Please install @nuxt/fonts:')
      logger.info('  npm add @nuxt/fonts')
    }
    else {
      logger.warn(`Could not migrate: ${result.message}`)
      logger.info('Please migrate manually.')
    }
  }
  else {
    logger.info('Skipping automatic migration. Please migrate manually.')
  }
}
