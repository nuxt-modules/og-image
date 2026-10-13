import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'pathe'
import { exec } from 'tinyexec'

const root = fileURLToPath(new URL('..', import.meta.url))
const fixtures = ['basic', 'takumi-font-weights', 'takumi-only-fonts', 'emojis', 'multi-font-families', 'public-sans-repro', 'tutorial', 'cloudflare-takumi']
for (const fixture of fixtures) {
  for (const dir of ['.nuxt', '.output'])
    await rm(join(root, 'test/fixtures', fixture, dir), { recursive: true, force: true })
}
await exec('pnpm', ['run', 'prepare:fixtures'], { throwOnError: true, nodeOptions: { cwd: root, stdio: 'inherit' } })
await exec('pnpm', [
  'exec',
  'vitest',
  'run',
  '--project',
  'e2e',
  '--maxWorkers',
  '2',
  'test/e2e/takumi.test.ts',
  'test/e2e/takumi-font-weights.test.ts',
  'test/e2e/takumi-only-fonts.test.ts',
  'test/e2e/local-emoji.test.ts',
  'test/e2e/multi-font-families.test.ts',
  'test/e2e/dev-satori-fonts.test.ts',
  'test/e2e/public-sans-repro.test.ts',
  'test/e2e/tutorial.test.ts',
], { throwOnError: true, nodeOptions: { cwd: root, stdio: 'inherit' } })
// Edge tests own Wrangler's port and run after the Node tests.
await exec('pnpm', ['exec', 'vitest', 'run', '--project', 'e2e', 'test/e2e-not-nuxt/cloudflare-takumi.test.ts'], {
  throwOnError: true,
  nodeOptions: { cwd: root, stdio: 'inherit', env: { ...process.env, CI: '' } },
})
