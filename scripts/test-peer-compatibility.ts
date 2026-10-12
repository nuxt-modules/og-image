import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'pathe'
import { exec } from 'tinyexec'

const root = fileURLToPath(new URL('..', import.meta.url))
for (const fixture of ['woff2-conversion', 'multi-font-families', 'cloudflare-satori']) {
  for (const dir of ['.nuxt', '.output'])
    await rm(join(root, 'test/fixtures', fixture, dir), { recursive: true, force: true })
}
await exec('pnpm', ['run', 'prepare:fixtures'], { throwOnError: true, nodeOptions: { cwd: root, stdio: 'inherit' } })
await exec('pnpm', ['exec', 'vitest', 'run', 'test/e2e/woff2-conversion.test.ts', 'test/e2e/multi-font-families.test.ts'], {
  throwOnError: true,
  nodeOptions: { cwd: root, stdio: 'inherit' },
})
// This process owns Wrangler's port. Run edge tests after the Node tests.
await exec('pnpm', ['exec', 'vitest', 'run', 'test/e2e-not-nuxt/cloudflare-satori.test.ts'], {
  throwOnError: true,
  nodeOptions: { cwd: root, stdio: 'inherit', env: { ...process.env, CI: '' } },
})
