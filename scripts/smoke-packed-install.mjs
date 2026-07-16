import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rootPackage = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const keepTemp = process.argv.includes('--keep')
const packageManagers = process.argv
  .find(arg => arg.startsWith('--pm='))
  ?.slice('--pm='.length)
  .split(',')
  .map(pm => pm.trim())
  .filter(Boolean) || ['pnpm', 'npm']
const tempRoot = await mkdtemp(join(tmpdir(), 'og-image-packed-smoke-'))
const optionalizedPackages = [
  '@unocss/config',
  '@unocss/core',
  'culori',
  'lightningcss',
  'tinyglobby',
]
const RE_ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

function log(message) {
  console.log(`[packed-smoke] ${message}`)
}

function run(cwd, command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      env: {
        ...process.env,
        CI: '1',
        ...options.env,
      },
    })
    let output = ''
    if (options.capture) {
      child.stdout.on('data', chunk => output += chunk)
      child.stderr.on('data', chunk => output += chunk)
    }
    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolveRun(output)
        return
      }
      const details = signal ? `signal ${signal}` : `exit code ${code}`
      reject(new Error(`${command} ${args.join(' ')} failed with ${details}\n${output}`))
    })
  })
}

function assert(condition, message) {
  if (!condition)
    throw new Error(message)
}

function assertNoWarnings(output, label) {
  const lines = output
    .replace(RE_ANSI, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  const warningLines = lines.filter(line =>
    /\b(?:warn|warning|error|failed)\b/i.test(line)
    || /missing peer|unmet peer|peer dep/i.test(line),
  )
  assert(warningLines.length === 0, `${label} emitted warning/error output:\n${warningLines.join('\n')}\n\nFull output:\n${output}`)
}

function assertNoPeerWarnings(output, label) {
  const lines = output
    .replace(RE_ANSI, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  const peerWarningLines = lines.filter(line => /missing peer|unmet peer|peer dep/i.test(line))
  assert(peerWarningLines.length === 0, `${label} emitted peer dependency warnings:\n${peerWarningLines.join('\n')}\n\nFull output:\n${output}`)
}

async function runClean(cwd, command, args, label) {
  const output = await run(cwd, command, args, { capture: true })
  assertNoWarnings(output, label)
  return output
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFiles(path))
      continue
    }
    files.push(path)
  }
  return files
}

async function packModule() {
  log('packing nuxt-og-image')
  await run(root, 'pnpm', ['pack', '--json', '--pack-destination', tempRoot], { capture: true })
  const files = await readdir(tempRoot)
  const tarball = files.find(file => /^nuxt-og-image-.+\.tgz$/.test(file))
  assert(tarball, 'pnpm pack did not produce a nuxt-og-image tarball')
  return join(tempRoot, tarball)
}

async function getPackageManagerField(pm) {
  if (pm === 'pnpm')
    return rootPackage.packageManager
  const version = (await run(root, pm, ['--version'], { capture: true })).trim()
  return `${pm}@${version}`
}

async function createApp(pm, name, dependencies, nuxtConfig) {
  const appDir = join(tempRoot, name)
  await mkdir(appDir, { recursive: true })
  await writeFile(join(appDir, 'package.json'), `${JSON.stringify({
    type: 'module',
    packageManager: await getPackageManagerField(pm),
    dependencies,
  }, null, 2)}\n`)
  if (pm === 'pnpm') {
    await writeFile(join(appDir, 'pnpm-workspace.yaml'), [
      'packages:',
      '  - .',
      'onlyBuiltDependencies:',
      '  - "@parcel/watcher"',
      '  - esbuild',
      'allowBuilds:',
      '  "@parcel/watcher": true',
      '  esbuild: true',
      'minimumReleaseAgeExclude:',
      '  - nuxtseo-shared@5.3.2',
      '',
    ].join('\n'))
  }
  await writeFile(join(appDir, 'nuxt.config.ts'), `${nuxtConfig.trim()}\n`)
  return appDir
}

async function install(pm, appDir) {
  const args = pm === 'pnpm'
    ? ['install', '--strict-peer-dependencies', '--reporter=append-only']
    : pm === 'npm'
      ? ['install', '--strict-peer-deps', '--loglevel=warn']
      : ['install']
  const output = await run(appDir, pm, args, { capture: true })
  assertNoPeerWarnings(output, `${pm} install`)
}

async function execPackage(pm, appDir, args, label) {
  if (pm === 'bun')
    return await runClean(appDir, 'bunx', ['--no-install', ...args], label)

  const commandArgs = pm === 'pnpm'
    ? ['exec', ...args]
    : ['exec', '--', ...args]
  return await runClean(appDir, pm, commandArgs, label)
}

async function readInstalledPackage(appDir) {
  return JSON.parse(await readFile(join(appDir, 'node_modules/nuxt-og-image/package.json'), 'utf8'))
}

function assertPackageMetadata(pkg) {
  for (const name of ['culori', 'tinyglobby']) {
    assert(!pkg.dependencies?.[name], `${name} should not be a runtime dependency`)
    assert(!pkg.peerDependencies?.[name], `${name} should not be a peer dependency`)
  }

  for (const name of ['@unocss/core', '@unocss/config', 'lightningcss']) {
    assert(!pkg.dependencies?.[name], `${name} should not be a runtime dependency`)
    assert(pkg.peerDependencies?.[name], `${name} should be declared as an optional peer`)
    assert(pkg.peerDependenciesMeta?.[name]?.optional === true, `${name} peer should be optional`)
  }
}

async function assertNoDirectDistImports(appDir) {
  const distDir = join(appDir, 'node_modules/nuxt-og-image/dist')
  const files = (await listFiles(distDir))
    .filter(file => /\.(?:cjs|mjs|js)$/.test(file))

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    for (const name of optionalizedPackages) {
      const escaped = escapeRegExp(name)
      const directImport = new RegExp(
        `(?:from\\s+['"]${escaped}(?:/[^'"]*)?['"]|import\\(\\s*['"]${escaped}(?:/[^'"]*)?['"]\\s*\\)|require\\(\\s*['"]${escaped}(?:/[^'"]*)?['"]\\s*\\))`,
      )
      assert(!directImport.test(source), `${name} is still directly imported by ${file}`)
    }
  }
}

async function assertNuxtOnlyApp(pm, tarball) {
  log(`checking clean Nuxt-only app with ${pm}`)
  const appDir = await createApp(pm, `${pm}-nuxt-only`, {
    'nuxt': '4.4.8',
    'nuxt-og-image': `file:${tarball}`,
  }, `
    export default defineNuxtConfig({
      modules: ['nuxt-og-image'],
    })
  `)

  await install(pm, appDir)
  assertPackageMetadata(await readInstalledPackage(appDir))
  await assertNoDirectDistImports(appDir)
  await execPackage(pm, appDir, ['nuxi', 'prepare'], `${pm} nuxi prepare`)
  await execPackage(pm, appDir, ['nuxt-og-image', 'migrate', 'v6', '--dry-run', '--yes'], `${pm} nuxt-og-image migrate`)
}

async function getSharedExports(appDir) {
  const unoChunk = join(appDir, 'node_modules/nuxt-og-image/dist/chunks/uno.mjs')
  const { resolveOptionalModulePath, importResolvedModule } = await import(pathToFileURL(unoChunk).href)
  assert(
    typeof resolveOptionalModulePath === 'function' && typeof importResolvedModule === 'function',
    `expected optional-module resolvers to be exported from ${unoChunk}`,
  )
  return { resolveOptionalModulePath, importResolvedModule }
}

async function assertUnoApp(pm, tarball) {
  log(`checking Uno app with ${pm} without direct Uno core/config or lightningcss deps`)
  const appDir = await createApp(pm, `${pm}-unocss`, {
    'nuxt': '4.4.8',
    '@unocss/nuxt': '66.7.4',
    'nuxt-og-image': `file:${tarball}`,
  }, `
    export default defineNuxtConfig({
      modules: ['@unocss/nuxt', 'nuxt-og-image'],
    })
  `)
  await writeFile(join(appDir, 'uno.config.ts'), 'export default {}\n')

  await install(pm, appDir)
  await execPackage(pm, appDir, ['nuxi', 'prepare'], `${pm} nuxi prepare with UnoCSS`)

  const pkg = JSON.parse(await readFile(join(appDir, 'package.json'), 'utf8'))
  for (const name of ['@unocss/core', '@unocss/config', 'lightningcss'])
    assert(!pkg.dependencies?.[name], `${name} should not be installed directly in the smoke app`)

  const { resolveOptionalModulePath, importResolvedModule } = await getSharedExports(appDir)
  const rootDir = appDir
  const [corePath, configPath, presetPath, lightningPath] = await Promise.all([
    resolveOptionalModulePath('@unocss/core', rootDir, ['@unocss/nuxt', 'unocss']),
    resolveOptionalModulePath('@unocss/config', rootDir, ['@unocss/nuxt', 'unocss']),
    resolveOptionalModulePath('@unocss/preset-wind', rootDir, ['@unocss/nuxt', 'unocss']),
    resolveOptionalModulePath('lightningcss', rootDir, ['vite', '@nuxt/fonts', 'fontless', '@unhead/bundler']),
  ])
  assert(corePath, 'expected @unocss/core to resolve through @unocss/nuxt')
  assert(configPath, 'expected @unocss/config to resolve through @unocss/nuxt')
  assert(presetPath, 'expected @unocss/preset-wind to resolve through @unocss/nuxt')
  if (pm === 'pnpm')
    assert(!lightningPath, 'pnpm smoke app unexpectedly resolved lightningcss')

  const { createUnoProvider, setUnoConfig, setUnoRootDir } = await import(pathToFileURL(join(appDir, 'node_modules/nuxt-og-image/dist/chunks/uno.mjs')).href)
  const { presetWind } = await importResolvedModule('@unocss/preset-wind', presetPath)

  setUnoRootDir(rootDir)
  setUnoConfig({ presets: [presetWind()] })
  const provider = createUnoProvider({ unocssCorePath: corePath, unocssConfigPath: configPath })
  const styles = await provider.resolveClassesToStyles(['text-red-500', 'font-bold'])
  assert(styles['text-red-500']?.color, 'Uno provider did not resolve text-red-500')
  assert(styles['font-bold']?.['font-weight'] === '700', 'Uno provider did not resolve font-bold')
}

try {
  const tarball = await packModule()
  for (const pm of packageManagers) {
    await assertNuxtOnlyApp(pm, tarball)
    await assertUnoApp(pm, tarball)
  }
  log('passed')
}
finally {
  if (keepTemp)
    log(`kept temp directory ${tempRoot}`)
  else
    await rm(tempRoot, { recursive: true, force: true })
}
