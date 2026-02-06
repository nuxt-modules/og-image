/**
 * Generate snapshot images for all community templates
 *
 * Usage:
 *   1. Start the playground: pnpm dev
 *   2. Run this script: npx tsx scripts/generate-template-snapshots.ts
 *
 * Or with custom base URL:
 *   npx tsx scripts/generate-template-snapshots.ts http://localhost:3000
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'pathe'
import { encodeOgImageParams } from '../src/runtime/shared/urlEncoding'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface SatoriTemplateEntry {
  name: string
  props: Record<string, any>
}

interface TakumiTemplateEntry {
  name: string
  pagePath: string
}

const satoriTemplates: SatoriTemplateEntry[] = [
  {
    name: 'NuxtSeo',
    props: {
      title: 'Build Better SEO with Nuxt',
      description: 'The complete SEO solution for Nuxt applications',
    },
  },
  {
    name: 'Nuxt',
    props: {
      title: 'The Intuitive Vue Framework',
      description: 'Build your next Vue.js application with confidence',
      headline: 'NUXT',
    },
  },
  {
    name: 'WithEmoji',
    props: {
      title: 'Ship features faster with confidence',
      emoji: '🚀',
    },
  },
  {
    name: 'SimpleBlog',
    props: {
      title: 'How to Build Modern Web Applications in 2025',
    },
  },
  {
    name: 'Frame',
    props: {
      title: 'Creative Developer',
      description: 'Building digital experiences that inspire and engage',
      icon: 'carbon:code',
    },
  },
  {
    name: 'Pergel',
    props: {
      title: 'Next-Gen Development Tools',
      description: 'Supercharge your workflow with modern tooling',
      headline: 'PERGEL',
    },
  },
  {
    name: 'UnJs',
    props: {
      title: 'unjs/nitro',
      description: 'Build and deploy universal JavaScript servers',
      emoji: '⚡',
      downloads: '5200000',
      stars: '6100',
      contributors: '180',
    },
  },
  {
    name: 'Brutalist',
    props: {
      title: 'Break The Rules',
      subtitle: 'Design Manifesto',
      accent: '#facc15',
    },
  },
  {
    name: 'SaaS',
    props: {
      title: 'Build better products, ship faster, delight customers.',
      siteName: 'Acme',
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
    },
  },
]

const takumiTemplates: TakumiTemplateEntry[] = [
  { name: 'BlogPost', pagePath: '/takumi/blog-post' },
  { name: 'Docs', pagePath: '/takumi/docs' },
  { name: 'NuxtSeo', pagePath: '/takumi/nuxt-seo' },
  { name: 'ProductCard', pagePath: '/takumi/product-card' },
]

const satoriFormats = [
  { ext: 'png', folder: '', label: 'PNG' },
  { ext: 'svg', folder: 'svg', label: 'SVG' },
  { ext: 'json', folder: 'json', label: 'JSON' },
]

const takumiFormats = [
  { ext: 'png', folder: '', label: 'PNG' },
  { ext: 'json', folder: 'json', label: 'JSON' },
]

const baseUrl = process.argv[2] || 'http://localhost:3000'
const outputDir = join(__dirname, '../docs/public/templates')

const dimensions = [
  { prefix: '', width: 1200, height: 630, label: 'OG' },
  { prefix: 'square-', width: 800, height: 800, label: 'Square' },
]

const colorModes = [
  { folder: '', colorMode: undefined, label: 'Default' },
  { folder: 'light', colorMode: 'light', label: 'Light' },
  { folder: 'dark', colorMode: 'dark', label: 'Dark' },
]

interface SnapshotResult { renderer: string, name: string, dimension: string, mode: string, format: string, status: 'success' | 'error', error?: string }

/**
 * Extract the og:image URL from a page's HTML
 */
async function extractOgImageUrl(pageUrl: string): Promise<string | null> {
  const response = await fetch(pageUrl).catch(() => null)
  if (!response?.ok)
    return null
  const html = await response.text()
  const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/)
  return match?.[1] || null
}

async function fetchAndSave(url: string, outputPath: string, ext: string): Promise<{ ok: boolean, size?: string, error?: string }> {
  const response = await fetch(url).catch((err: Error) => {
    return { ok: false as const, error: err.message }
  })

  if ('error' in response)
    return { ok: false, error: response.error }

  if (!response.ok)
    return { ok: false, error: `HTTP ${response.status}` }

  let data: Buffer | string
  if (ext === 'json') {
    const json = await response.json()
    data = JSON.stringify(json.vnodes ?? json, null, 2)
  }
  else {
    data = Buffer.from(await response.arrayBuffer())
  }
  writeFileSync(outputPath, data)
  return { ok: true, size: (Buffer.byteLength(data) / 1024).toFixed(1) }
}

async function generateSnapshots() {
  console.log(`Generating template snapshots from ${baseUrl}`)
  console.log(`Output directory: ${outputDir}\n`)

  // Create all output directories
  for (const renderer of ['satori', 'takumi']) {
    const formats = renderer === 'satori' ? satoriFormats : takumiFormats
    for (const format of formats) {
      for (const mode of colorModes) {
        const parts = [renderer, format.folder, mode.folder].filter(Boolean)
        const path = join(outputDir, ...parts)
        if (!existsSync(path))
          mkdirSync(path, { recursive: true })
      }
    }
  }

  const results: SnapshotResult[] = []

  // === Satori templates (direct encoded URL) ===
  console.log(`\n${'='.repeat(40)}`)
  console.log(`  RENDERER: satori`)
  console.log(`${'='.repeat(40)}`)

  for (const format of satoriFormats) {
    for (const mode of colorModes) {
      const sectionLabel = [format.label, mode.label !== 'Default' ? mode.label : ''].filter(Boolean).join(' ')
      console.log(`\n=== ${sectionLabel} ===`)

      for (const dim of dimensions) {
        console.log(`\n--- ${dim.label} (${dim.width}x${dim.height}) ---`)

        for (const template of satoriTemplates) {
          const props = { ...template.props }
          if (mode.colorMode)
            props.colorMode = mode.colorMode

          const encoded = encodeOgImageParams({
            component: template.name,
            width: dim.width,
            height: dim.height,
            emojis: 'noto',
            props,
          })
          const url = `${baseUrl}/_og/d/${encoded}.${format.ext}`
          const parts = ['satori', format.folder, mode.folder].filter(Boolean)
          const outDir = join(outputDir, ...parts)
          const outputPath = join(outDir, `${dim.prefix}${template.name}.${format.ext}`)

          process.stdout.write(`  ${dim.prefix}${template.name}... `)

          const result = await fetchAndSave(url, outputPath, format.ext)
          if (result.ok) {
            results.push({ renderer: 'satori', name: template.name, dimension: dim.label, mode: mode.label, format: format.label, status: 'success' })
            console.log(`OK (${result.size}kb)`)
          }
          else {
            results.push({ renderer: 'satori', name: template.name, dimension: dim.label, mode: mode.label, format: format.label, status: 'error', error: result.error })
            console.log(`FAILED (${result.error})`)
          }
        }
      }
    }
  }

  // === Takumi templates (via playground page og:image URLs) ===
  console.log(`\n${'='.repeat(40)}`)
  console.log(`  RENDERER: takumi`)
  console.log(`${'='.repeat(40)}`)

  // Pre-fetch og:image base URLs from playground pages
  const takumiBaseUrls = new Map<string, string>()
  for (const template of takumiTemplates) {
    const pageUrl = `${baseUrl}${template.pagePath}`
    process.stdout.write(`  Resolving ${template.name} from ${template.pagePath}... `)
    const ogUrl = await extractOgImageUrl(pageUrl)
    if (ogUrl) {
      takumiBaseUrls.set(template.name, ogUrl)
      console.log('OK')
    }
    else {
      console.log('FAILED (could not extract og:image)')
    }
  }

  for (const format of takumiFormats) {
    for (const mode of colorModes) {
      const sectionLabel = [format.label, mode.label !== 'Default' ? mode.label : ''].filter(Boolean).join(' ')
      console.log(`\n=== ${sectionLabel} ===`)

      for (const dim of dimensions) {
        console.log(`\n--- ${dim.label} (${dim.width}x${dim.height}) ---`)

        for (const template of takumiTemplates) {
          const ogImageUrl = takumiBaseUrls.get(template.name)
          if (!ogImageUrl) {
            results.push({ renderer: 'takumi', name: template.name, dimension: dim.label, mode: mode.label, format: format.label, status: 'error', error: 'no og:image URL' })
            process.stdout.write(`  ${dim.prefix}${template.name}... `)
            console.log('SKIPPED (no og:image URL)')
            continue
          }

          // Parse og:image URL and apply dimension/colorMode overrides
          const resolvedOgUrl = ogImageUrl.startsWith('http') ? ogImageUrl : `${baseUrl}${ogImageUrl}`
          const parsed = new URL(resolvedOgUrl)
          // Swap extension on pathname
          parsed.pathname = parsed.pathname.replace(/\.\w+$/, `.${format.ext}`)
          parsed.searchParams.set('width', String(dim.width))
          parsed.searchParams.set('height', String(dim.height))
          if (mode.colorMode)
            parsed.searchParams.set('colorMode', mode.colorMode)
          const url = parsed.toString()

          const parts = ['takumi', format.folder, mode.folder].filter(Boolean)
          const outDir = join(outputDir, ...parts)
          const outputPath = join(outDir, `${dim.prefix}${template.name}.${format.ext}`)

          process.stdout.write(`  ${dim.prefix}${template.name}... `)

          const result = await fetchAndSave(url, outputPath, format.ext)
          if (result.ok) {
            results.push({ renderer: 'takumi', name: template.name, dimension: dim.label, mode: mode.label, format: format.label, status: 'success' })
            console.log(`OK (${result.size}kb)`)
          }
          else {
            results.push({ renderer: 'takumi', name: template.name, dimension: dim.label, mode: mode.label, format: format.label, status: 'error', error: result.error })
            console.log(`FAILED (${result.error})`)
          }
        }
      }
    }
  }

  const total = satoriTemplates.length * dimensions.length * colorModes.length * satoriFormats.length
    + takumiTemplates.length * dimensions.length * colorModes.length * takumiFormats.length
  console.log('\n--- Summary ---')
  const successful = results.filter(r => r.status === 'success')
  const failed = results.filter(r => r.status === 'error')

  console.log(`Success: ${successful.length}/${total}`)
  if (failed.length > 0) {
    console.log(`Failed: ${failed.map(f => `${f.renderer}/${f.format}/${f.mode}/${f.dimension}/${f.name}`).join(', ')}`)
  }

  console.log(`\nSnapshots saved to: ${outputDir}`)
}

generateSnapshots()
