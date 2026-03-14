import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'pathe'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const communityDir = join(root, 'src/runtime/app/components/Templates/Community')
const fixturesDir = join(root, 'test/fixtures')

// These fixtures build themselves in their tests (nuxt build/generate) — skip nuxt prepare
const selfBuildFixtures = new Set([
  'app-dir',
  'cloudflare-satori',
  'cloudflare-takumi',
  'vercel-edge-satori',
  'zero-runtime',
])

const fixtures = readdirSync(fixturesDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('.') && !selfBuildFixtures.has(d.name))
  .map(d => `test/fixtures/${d.name}`)

const templates = readdirSync(communityDir).filter(f => f.endsWith('.vue'))

// Eject community templates (fast, run sequentially)
for (const fixture of fixtures) {
  const targetDir = join(root, fixture, 'components/OgImageCommunity')
  if (existsSync(targetDir))
    rmSync(targetDir, { recursive: true })
  mkdirSync(targetDir, { recursive: true })
  for (const template of templates) {
    cpSync(join(communityDir, template), join(targetDir, template))
  }
}

function prepareFixture(fixture) {
  return new Promise((resolve, reject) => {
    const proc = spawn('nuxt', ['prepare', fixture], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    proc.stderr.on('data', d => stderr += d)
    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`  ✓ ${fixture}`)
        resolve()
      }
      else {
        reject(new Error(`${fixture} failed:\n${stderr}`))
      }
    })
    proc.on('error', reject)
  })
}

// Run nuxt prepare in parallel batches
const concurrency = Number(process.env.PREPARE_CONCURRENCY) || 4
console.log(`Preparing ${fixtures.length} fixtures (concurrency: ${concurrency})...\n`)

for (let i = 0; i < fixtures.length; i += concurrency) {
  const batch = fixtures.slice(i, i + concurrency)
  await Promise.all(batch.map(f => prepareFixture(f)))
}

console.log('\nDone!')
