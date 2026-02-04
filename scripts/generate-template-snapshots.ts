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

const templates: { name: string, props: Record<string, any> }[] = [
  {
    name: 'NuxtSeo',
    props: {
      title: 'Build Better SEO with Nuxt',
      description: 'The complete SEO solution for Nuxt applications',
      colorMode: 'dark',
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
    name: 'Retro',
    props: {
      title: 'Welcome to the Grid',
      tagline: 'Synthwave Dreams',
    },
  },
  {
    name: 'Newspaper',
    props: {
      title: 'Revolutionary AI Changes Everything We Know About Technology',
      category: 'Technology',
      publication: 'The Daily Chronicle',
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

const baseUrl = process.argv[2] || 'http://localhost:3000'
const outputDir = join(__dirname, '../docs/public/templates')

const dimensions = [
  { prefix: '', width: 1200, height: 630, label: 'OG' },
  { prefix: 'square-', width: 800, height: 800, label: 'Square' },
]

async function generateSnapshots() {
  console.log(`Generating template snapshots from ${baseUrl}`)
  console.log(`Output directory: ${outputDir}\n`)

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const results: { name: string, dimension: string, status: 'success' | 'error', error?: string }[] = []

  for (const dim of dimensions) {
    console.log(`\n--- ${dim.label} (${dim.width}x${dim.height}) ---`)

    for (const template of templates) {
      // Build URL using new /_og/d/ format with encoded params in path
      const encoded = encodeOgImageParams({
        component: template.name,
        width: dim.width,
        height: dim.height,
        emojis: 'noto',
        props: template.props,
      })
      const url = `${baseUrl}/_og/d/${encoded}.png`
      const outputPath = join(outputDir, `${dim.prefix}${template.name}.png`)

      process.stdout.write(`  ${dim.prefix}${template.name}... `)

      const response = await fetch(url).catch((err: Error) => {
        results.push({ name: template.name, dimension: dim.label, status: 'error', error: err.message })
        console.log(`FAILED (${err.message})`)
        return null
      })

      if (!response)
        continue

      if (!response.ok) {
        results.push({ name: template.name, dimension: dim.label, status: 'error', error: `HTTP ${response.status}` })
        console.log(`FAILED (HTTP ${response.status})`)
        continue
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      writeFileSync(outputPath, buffer)
      results.push({ name: template.name, dimension: dim.label, status: 'success' })
      console.log(`OK (${(buffer.length / 1024).toFixed(1)}kb)`)
    }
  }

  const total = templates.length * dimensions.length
  console.log('\n--- Summary ---')
  const successful = results.filter(r => r.status === 'success')
  const failed = results.filter(r => r.status === 'error')

  console.log(`Success: ${successful.length}/${total}`)
  if (failed.length > 0) {
    console.log(`Failed: ${failed.map(f => `${f.dimension}/${f.name}`).join(', ')}`)
  }

  console.log(`\nSnapshots saved to: ${outputDir}`)
}

generateSnapshots()
