import { Transformer } from '@napi-rs/image'
import { Resvg } from '@resvg/resvg-js'

const simpleSvg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <text x="50%" y="50%" text-anchor="middle" font-size="48" fill="black">Hello World</text>
</svg>`

const complexSvg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="40" y="40" width="1120" height="550" rx="20" fill="rgba(255,255,255,0.1)"/>
  <text x="100" y="180" font-size="64" font-weight="bold" fill="white">My Blog Post Title</text>
  <text x="100" y="260" font-size="32" fill="rgba(255,255,255,0.8)">A subtitle with more detail about the content</text>
  <rect x="100" y="300" width="200" height="4" fill="rgba(255,255,255,0.5)"/>
  <text x="100" y="380" font-size="24" fill="rgba(255,255,255,0.6)">Author Name • March 2025</text>
  ${Array.from({ length: 20 }, (_, i) =>
    `<circle cx="${100 + i * 55}" cy="500" r="20" fill="rgba(255,255,255,${0.1 + i * 0.04})"/>`).join('\n  ')}
</svg>`

async function bench(name, fn, iterations = 100) {
  // Warmup
  for (let i = 0; i < 5; i++) await fn()

  const times = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    times.push(performance.now() - start)
  }

  times.sort((a, b) => a - b)
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const p50 = times[Math.floor(times.length * 0.5)]
  const p95 = times[Math.floor(times.length * 0.95)]
  const p99 = times[Math.floor(times.length * 0.99)]

  console.log(`${name}`)
  console.log(`  avg: ${avg.toFixed(2)}ms  p50: ${p50.toFixed(2)}ms  p95: ${p95.toFixed(2)}ms  p99: ${p99.toFixed(2)}ms`)
  return { avg, p50, p95, p99 }
}

console.log('=== SVG → PNG Benchmark ===\n')
console.log('--- Simple SVG (1200x630, text + rect) ---')

const resvgSimple = await bench('resvg', () => {
  const resvg = new Resvg(simpleSvg, { fitTo: { mode: 'width', value: 1200 } })
  return resvg.render().asPng()
})

const napiSimple = await bench('@napi-rs/image', () => {
  return Transformer.fromSvg(simpleSvg, 'white').png()
})

console.log(`  speedup: ${(resvgSimple.avg / napiSimple.avg).toFixed(2)}x (>1 = @napi-rs/image faster)\n`)

console.log('--- Complex SVG (gradient, shapes, text) ---')

const resvgComplex = await bench('resvg', () => {
  const resvg = new Resvg(simpleSvg, { fitTo: { mode: 'width', value: 1200 } })
  return resvg.render().asPng()
})

const napiComplex = await bench('@napi-rs/image', () => {
  return Transformer.fromSvg(complexSvg, 'white').png()
})

console.log(`  speedup: ${(resvgComplex.avg / napiComplex.avg).toFixed(2)}x (>1 = @napi-rs/image faster)\n`)

// Verify output sizes
const resvgPng = new Resvg(complexSvg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng()
const napiPng = await Transformer.fromSvg(complexSvg, 'white').png()
console.log(`Output sizes: resvg=${resvgPng.byteLength} bytes, @napi-rs/image=${napiPng.byteLength} bytes`)
