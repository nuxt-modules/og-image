import { lstat, readlink, rm, symlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'pathe'
import { exec } from 'tinyexec'

const root = fileURLToPath(new URL('..', import.meta.url))
const profiles = {
  minimum: { fontless: 'fontless-v0-2', unifont: 'unifont-v0-7' },
  current: {},
}
const selected = process.argv[2]
if (selected && !(selected in profiles))
  throw new Error(`Unknown peer profile: ${selected}`)

const packages = Object.keys(profiles.minimum)
const originalLinks = new Map()
for (const name of packages) {
  const path = join(root, 'node_modules', name)
  if (!(await lstat(path)).isSymbolicLink())
    throw new Error(`Expected a pnpm package link: ${path}`)
  originalLinks.set(name, await readlink(path))
}

async function restoreLinks() {
  for (const [name, target] of originalLinks) {
    const path = join(root, 'node_modules', name)
    await rm(path)
    await symlink(target, path)
  }
}

try {
  for (const [profile, aliases] of Object.entries(profiles)) {
    if (selected && profile !== selected)
      continue
    await restoreLinks()
    for (const [name, alias] of Object.entries(aliases)) {
      const path = join(root, 'node_modules', name)
      const target = await readlink(join(root, 'node_modules', alias))
      await rm(path)
      await symlink(target, path)
    }
    console.log(`Testing peer compatibility: ${profile}`)
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
  }
}
finally {
  await restoreLinks()
}
