import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstat, mkdir, readdir, readFile, readlink, realpath, rm, symlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scopeDir = join(root, 'node_modules', '@takumi-rs')
const require = createRequire(import.meta.url)
const requireFromJestImageSnapshot = createRequire(require.resolve('jest-image-snapshot/package.json'))
const pixelmatch = requireFromJestImageSnapshot('pixelmatch')
const { PNG } = requireFromJestImageSnapshot('pngjs')

const takumiPackages = [
  { name: 'core', alias: 'core-v1' },
  { name: 'helpers', alias: 'helpers-v1' },
  { name: 'wasm', alias: 'wasm-v1' },
]

const testFiles = [
  'test/e2e/takumi.test.ts',
  'test/e2e/takumi-only-fonts.test.ts',
  'test/e2e/local-emoji.test.ts',
  'test/e2e/multi-font-families.test.ts',
  'test/e2e/dev-satori-fonts.test.ts',
  'test/e2e/public-sans-repro.test.ts',
  'test/e2e/tutorial.test.ts',
  'test/e2e-not-nuxt/cloudflare-takumi.test.ts',
]

const fixtureBuildDirs = [
  'test/fixtures/basic',
  'test/fixtures/takumi-only-fonts',
  'test/fixtures/emojis',
  'test/fixtures/multi-font-families',
  'test/fixtures/public-sans-repro',
  'test/fixtures/tutorial',
  'test/fixtures/cloudflare-takumi',
]

const args = process.argv.slice(2).filter(arg => arg !== '--')
const matrix = args.includes('--matrix')
const compare = args.includes('--compare')
const takumiArg = args.find(arg => arg.startsWith('--takumi='))
const selectedTakumi = takumiArg?.split('=')[1]
const maxDiffArg = args.find(arg => arg.startsWith('--max-diff='))
const maxDiffRatio = maxDiffArg ? Number.parseFloat(maxDiffArg.split('=')[1] || '') : 0.01
const passthroughArgs = args.filter(arg => !['--matrix', '--compare', takumiArg, maxDiffArg].includes(arg))

if (!Number.isFinite(maxDiffRatio))
  throw new Error(`Invalid --max-diff value in "${maxDiffArg}". Expected a decimal ratio, for example --max-diff=0.01.`)

function run(command, args, env = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...env,
      },
    })
    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolveRun()
        return
      }
      reject(new Error(`${command} ${args.join(' ')} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`))
    })
  })
}

async function assertPnpmSymlink(name) {
  const pkgPath = join(scopeDir, name)
  const stat = await lstat(pkgPath).catch(() => null)
  if (!stat)
    throw new Error(`Missing ${pkgPath}. Run pnpm install first.`)
  if (!stat.isSymbolicLink())
    throw new Error(`${pkgPath} is not a symlink. The Takumi matrix runner expects a pnpm install.`)
}

async function snapshotLinks() {
  const links = {}
  for (const pkg of takumiPackages) {
    await assertPnpmSymlink(pkg.name)
    await assertPnpmSymlink(pkg.alias)
    links[pkg.name] = await readlink(join(scopeDir, pkg.name))
  }
  return links
}

async function restoreLinks(links) {
  for (const pkg of takumiPackages) {
    const canonicalPath = join(scopeDir, pkg.name)
    await rm(canonicalPath, { force: true, recursive: true })
    await symlink(links[pkg.name], canonicalPath)
  }
}

async function switchToV1() {
  for (const pkg of takumiPackages) {
    const canonicalPath = join(scopeDir, pkg.name)
    const aliasTarget = await readlink(join(scopeDir, pkg.alias))
    await rm(canonicalPath, { force: true, recursive: true })
    await symlink(aliasTarget, canonicalPath)
  }
}

async function getPackageVersion(name) {
  const packageJsonPath = await realpath(join(scopeDir, name, 'package.json'))
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  return packageJson.version
}

async function getTakumiVersions() {
  return Object.fromEntries(await Promise.all(
    takumiPackages.map(async pkg => [pkg.name, await getPackageVersion(pkg.name)]),
  ))
}

function getMajor(version) {
  return Number.parseInt(version.split('.')[0] || '', 10)
}

async function clearFixtureBuildDirs() {
  await Promise.all(fixtureBuildDirs.flatMap(fixture => [
    rm(join(root, fixture, '.nuxt'), { force: true, recursive: true }),
    rm(join(root, fixture, '.output'), { force: true, recursive: true }),
  ]))
}

async function runTakumiE2E(label) {
  const versions = await getTakumiVersions()
  console.log(`\nRunning Takumi e2e tests (${label})`)
  console.log(`  @takumi-rs/core ${versions.core}`)
  console.log(`  @takumi-rs/helpers ${versions.helpers}`)
  console.log(`  @takumi-rs/wasm ${versions.wasm}\n`)

  await clearFixtureBuildDirs()
  await run('pnpm', ['run', 'prepare:fixtures'])
  await run('pnpm', [
    'exec',
    'vitest',
    'run',
    ...testFiles,
    '--project',
    'e2e',
    ...passthroughArgs,
  ], {
    TAKUMI_VERSION_UNDER_TEST: label,
  })
}

async function captureTakumiE2E(label, captureDir) {
  const versions = await getTakumiVersions()
  console.log(`\nCapturing Takumi e2e renders (${label})`)
  console.log(`  @takumi-rs/core ${versions.core}`)
  console.log(`  @takumi-rs/helpers ${versions.helpers}`)
  console.log(`  @takumi-rs/wasm ${versions.wasm}\n`)

  await clearFixtureBuildDirs()
  await run('pnpm', ['run', 'prepare:fixtures'])
  await run('pnpm', [
    'exec',
    'vitest',
    'run',
    'test/e2e/takumi-version-capture.test.ts',
    '--project',
    'e2e',
    ...passthroughArgs,
  ], {
    TAKUMI_CAPTURE_DIR: captureDir,
    TAKUMI_VERSION_UNDER_TEST: label,
  })
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function comparePngBuffers(name, v1Buffer, v2Buffer) {
  const v1 = PNG.sync.read(v1Buffer)
  const v2 = PNG.sync.read(v2Buffer)
  if (v1.width !== v2.width || v1.height !== v2.height) {
    return {
      name,
      sameHash: false,
      diffPixels: Infinity,
      diffRatio: Infinity,
      dimensions: `${v1.width}x${v1.height} vs ${v2.width}x${v2.height}`,
    }
  }

  const diff = new PNG({ width: v1.width, height: v1.height })
  const diffPixels = pixelmatch(v1.data, v2.data, diff.data, v1.width, v1.height, { threshold: 0.1 })
  return {
    name,
    sameHash: sha256(v1Buffer) === sha256(v2Buffer),
    diffPixels,
    diffRatio: diffPixels / (v1.width * v1.height),
    dimensions: `${v1.width}x${v1.height}`,
  }
}

async function compareTakumiCaptures(baseDir) {
  const v1Dir = join(baseDir, 'v1')
  const v2Dir = join(baseDir, 'v2')
  const images = (await readdir(v1Dir))
    .filter(file => file.endsWith('.png'))
    .sort()

  const results = []
  for (const image of images) {
    results.push(comparePngBuffers(
      image,
      await readFile(join(v1Dir, image)),
      await readFile(join(v2Dir, image)),
    ))
  }

  console.log('\nTakumi v1/v2 direct pixel diff')
  for (const result of results) {
    const percentage = Number.isFinite(result.diffRatio)
      ? `${(result.diffRatio * 100).toFixed(4)}%`
      : 'dimension mismatch'
    console.log(`  ${result.name.padEnd(20)} ${result.sameHash ? 'exact' : percentage.padStart(10)}  ${result.dimensions}`)
  }

  const failures = results.filter(result => !result.sameHash && result.diffRatio > maxDiffRatio)
  if (failures.length) {
    throw new Error(`Takumi v1/v2 compare exceeded max diff ${(maxDiffRatio * 100).toFixed(2)}% for: ${failures.map(f => f.name).join(', ')}`)
  }
}

if (selectedTakumi && !['v1', 'v2'].includes(selectedTakumi))
  throw new Error(`Unsupported --takumi value "${selectedTakumi}". Use --takumi=v1 or --takumi=v2.`)

const originalLinks = await snapshotLinks()

try {
  if (compare) {
    const versions = await getTakumiVersions()
    if (getMajor(versions.core) !== 2 || getMajor(versions.helpers) !== 2 || getMajor(versions.wasm) !== 2)
      throw new Error('Takumi compare expects the canonical @takumi-rs packages to be v2 before switching to the v1 aliases.')

    const captureBaseDir = join(root, '.tmp', 'takumi-e2e-compare')
    await rm(captureBaseDir, { force: true, recursive: true })
    await mkdir(captureBaseDir, { recursive: true })

    await captureTakumiE2E('v2', join(captureBaseDir, 'v2'))
    await switchToV1()
    await captureTakumiE2E('v1', join(captureBaseDir, 'v1'))
    await compareTakumiCaptures(captureBaseDir)
  }
  else if (matrix) {
    const versions = await getTakumiVersions()
    if (getMajor(versions.core) !== 2 || getMajor(versions.helpers) !== 2 || getMajor(versions.wasm) !== 2)
      throw new Error('Takumi matrix expects the canonical @takumi-rs packages to be v2 before switching to the v1 aliases.')

    await runTakumiE2E('v2')
    await switchToV1()
    await runTakumiE2E('v1')
  }
  else if (selectedTakumi === 'v1') {
    await switchToV1()
    await runTakumiE2E('v1')
  }
  else {
    await restoreLinks(originalLinks)
    await runTakumiE2E(selectedTakumi || 'current')
  }
}
finally {
  await restoreLinks(originalLinks)
}
