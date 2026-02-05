import type { OgImageComponent, OgImageRuntimeConfig } from '../../types'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'pathe'
import { logger } from './logger'

const ejectedTemplates = new Set<string>()

export function autoEjectCommunityTemplate(
  component: OgImageComponent,
  runtimeConfig: OgImageRuntimeConfig,
  options?: { requestPath?: string },
): void {
  if (!import.meta.dev)
    return

  // skip devtools/debug requests — only eject from actual page renders
  if (options?.requestPath?.includes('/_og/')) {
    return
  }

  const { srcDir, communityTemplatesDir } = runtimeConfig
  if (!srcDir || !communityTemplatesDir)
    return

  // already processed this session
  if (ejectedTemplates.has(component.pascalName))
    return

  ejectedTemplates.add(component.pascalName)

  // determine filename from pascalName (e.g., OgImageNuxtSeoSatori -> NuxtSeo.satori.vue)
  const baseName = component.pascalName
    .replace(/^OgImage/, '')
    .replace(/(Satori|Browser|Takumi)$/, '')
  const filename = `${baseName}.${component.renderer}.vue`

  const outputDir = join(srcDir, 'components', 'OgImage')
  const outputPath = join(outputDir, filename)

  // already exists in user's project
  if (existsSync(outputPath))
    return

  const templatePath = join(communityTemplatesDir, filename)
  if (!existsSync(templatePath)) {
    logger.warn(`[nuxt-og-image] Community template not found: ${templatePath}`)
    return
  }

  // create output directory if needed
  if (!existsSync(outputDir))
    mkdirSync(outputDir, { recursive: true })

  // copy template
  const content = readFileSync(templatePath, 'utf-8')
  writeFileSync(outputPath, content, 'utf-8')

  logger.info(`Auto-ejected community template "${baseName}" to ${outputPath}`)
}
