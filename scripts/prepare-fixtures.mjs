import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'pathe'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const communityDir = join(root, 'src/runtime/app/components/Templates/Community')
const fixturesDir = join(root, 'test/fixtures')

const fixtures = readdirSync(fixturesDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => `test/fixtures/${d.name}`)

const templates = readdirSync(communityDir).filter(f => f.endsWith('.vue'))

for (const fixture of fixtures) {
  console.log(`\nPreparing ${fixture}...`)

  // Eject community templates to OgImageCommunity folder (separate from user's OgImage components)
  const targetDir = join(root, fixture, 'components/OgImageCommunity')
  if (existsSync(targetDir))
    rmSync(targetDir, { recursive: true })
  mkdirSync(targetDir, { recursive: true })

  for (const template of templates) {
    cpSync(join(communityDir, template), join(targetDir, template))
  }
  console.log(`  Ejected ${templates.length} community templates to OgImageCommunity/`)

  // Run nuxt prepare
  execSync(`nuxt prepare ${fixture}`, { cwd: root, stdio: 'inherit' })
}

console.log('\nDone!')
