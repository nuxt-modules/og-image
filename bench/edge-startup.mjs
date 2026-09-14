import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'pathe'

const scriptPath = fileURLToPath(import.meta.url)

function stats(values) {
  const mean = values.reduce((total, value) => total + value, 0) / values.length
  const variance = values.length > 1
    ? values.reduce((total, value) => total + (value - mean) ** 2, 0) / (values.length - 1)
    : 0
  const sem = Math.sqrt(variance) / Math.sqrt(values.length)
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]

  return {
    mean,
    median,
    min: sorted[0],
    max: sorted.at(-1),
    rme: mean === 0 ? 0 : (sem * 1.96 / mean) * 100,
  }
}

function byteLength(value) {
  if (value instanceof ArrayBuffer)
    return value.byteLength
  if (ArrayBuffer.isView(value))
    return value.byteLength
  return 0
}

async function sample(entry) {
  const NativeModule = WebAssembly.Module
  let moduleConstructions = 0
  let moduleBytes = 0
  let instantiateCalls = 0
  let instantiateBytes = 0

  WebAssembly.Module = new Proxy(NativeModule, {
    construct(target, args) {
      moduleConstructions++
      moduleBytes += byteLength(args[0])
      return Reflect.construct(target, args)
    },
  })

  const nativeInstantiate = WebAssembly.instantiate
  WebAssembly.instantiate = function (...args) {
    instantiateCalls++
    instantiateBytes += byteLength(args[0])
    return nativeInstantiate.apply(WebAssembly, args)
  }

  const rssBefore = process.memoryUsage().rss
  const readCpuUsage = process.threadCpuUsage
    ? process.threadCpuUsage.bind(process)
    : process.cpuUsage.bind(process)
  const cpuBefore = readCpuUsage()
  const startedAt = performance.now()

  await import(`${pathToFileURL(entry).href}?sample=${process.pid}`)
  await new Promise(resolve => setImmediate(resolve))

  const cpu = readCpuUsage(cpuBefore)
  process.stdout.write(`${JSON.stringify({
    wallMs: performance.now() - startedAt,
    cpuMs: (cpu.user + cpu.system) / 1000,
    rssBytes: process.memoryUsage().rss - rssBefore,
    moduleConstructions,
    moduleBytes,
    instantiateCalls,
    instantiateBytes,
  })}\n`)
}

function measure(entry) {
  const sampleCount = Number.parseInt(process.env.BENCH_SAMPLES || '12', 10)
  const samples = Array.from({ length: sampleCount }, () => {
    const output = execFileSync(process.execPath, [scriptPath, '--sample', entry], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    return JSON.parse(output.trim().split('\n').at(-1))
  })
  const values = key => stats(samples.map(sample => sample[key]))

  process.stdout.write(`${JSON.stringify({
    samples: sampleCount,
    entryBytes: statSync(entry).size,
    startup: {
      wallMs: values('wallMs'),
      cpuMs: values('cpuMs'),
      rssBytes: values('rssBytes'),
    },
    wasm: {
      moduleConstructions: values('moduleConstructions'),
      moduleBytes: values('moduleBytes'),
      instantiateCalls: values('instantiateCalls'),
      instantiateBytes: values('instantiateBytes'),
    },
  }, null, 2)}\n`)
}

function percent(base, head) {
  if (base === 0)
    return head === 0 ? '0.0%' : 'new'
  const value = ((head - base) / Math.abs(base)) * 100
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function milliseconds(value, rme) {
  return `${value.toFixed(1)} ms ±${rme.toFixed(1)}%`
}

function bytes(value) {
  if (Math.abs(value) < 1024 * 1024)
    return `${(value / 1024).toFixed(1)} KiB`
  return `${(value / 1024 / 1024).toFixed(1)} MiB`
}

function compare(basePath, headPath) {
  const base = JSON.parse(readFileSync(basePath, 'utf8'))
  const head = JSON.parse(readFileSync(headPath, 'utf8'))
  const baseModules = base.wasm.moduleConstructions.median
  const headModules = head.wasm.moduleConstructions.median
  const baseInstantiates = base.wasm.instantiateCalls.median
  const headInstantiates = head.wasm.instantiateCalls.median
  const regressed = headModules > baseModules || headInstantiates > baseInstantiates
  const fullyLazy = headModules === 0 && headInstantiates === 0
  const improved = headModules < baseModules || headInstantiates < baseInstantiates

  let verdict = 'No structural startup change.'
  if (regressed)
    verdict = 'WASM startup work increased.'
  else if (fullyLazy)
    verdict = 'Lazy route boundary preserved. No WASM work runs during cold import.'
  else if (improved)
    verdict = `Partial improvement. Cold import still constructs ${headModules} WASM module${headModules === 1 ? '' : 's'} and starts ${headInstantiates} instantiation${headInstantiates === 1 ? '' : 's'}.`

  const rows = [
    ['Cold import CPU', milliseconds(base.startup.cpuMs.mean, base.startup.cpuMs.rme), milliseconds(head.startup.cpuMs.mean, head.startup.cpuMs.rme), percent(base.startup.cpuMs.mean, head.startup.cpuMs.mean)],
    ['Cold import wall', milliseconds(base.startup.wallMs.mean, base.startup.wallMs.rme), milliseconds(head.startup.wallMs.mean, head.startup.wallMs.rme), percent(base.startup.wallMs.mean, head.startup.wallMs.mean)],
    ['Cold import RSS', bytes(base.startup.rssBytes.median), bytes(head.startup.rssBytes.median), percent(base.startup.rssBytes.median, head.startup.rssBytes.median)],
    ['WASM modules constructed', String(baseModules), String(headModules), String(headModules - baseModules)],
    ['WASM module bytes compiled', bytes(base.wasm.moduleBytes.median), bytes(head.wasm.moduleBytes.median), percent(base.wasm.moduleBytes.median, head.wasm.moduleBytes.median)],
    ['WASM instantiations started', String(baseInstantiates), String(headInstantiates), String(headInstantiates - baseInstantiates)],
    ['Server entry', bytes(base.entryBytes), bytes(head.entryBytes), percent(base.entryBytes, head.entryBytes)],
  ]
  const report = [
    '### Edge startup benchmark',
    '',
    verdict,
    '',
    '| Metric | base | PR | change |',
    '|---|---:|---:|---:|',
    ...rows.map(row => `| ${row.join(' | ')} |`),
    '',
    `Each timing uses ${head.samples} fresh Node processes. WASM counters are deterministic and drive the verdict.`,
  ].join('\n')

  process.stdout.write(`${report}\n`)
  if (regressed)
    process.exitCode = 1
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (command === '--sample')
    await sample(resolve(args[0]))
  else if (command === '--compare')
    compare(resolve(args[0]), resolve(args[1]))
  else if (command)
    measure(resolve(command))
  else
    throw new TypeError('Usage: node bench/edge-startup.mjs <server-entry> | --compare <base.json> <head.json>')
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`)
  process.exitCode = 1
})
