import { describe, expect, it } from 'vitest'

// Mirrors the pure function from src/runtime/server/og-image/takumi/renderer.ts.
// Keep in sync with the source — the runtime module imports from h3/nitro which
// can't resolve in unit tests, so we duplicate the implementation here.
//
// Regression: @nuxt/fonts emits per-weight @font-face entries all pointing at
// the same variable WOFF2 URL. Loading that binary into takumi under multiple
// weight labels prevented takumi from varying the wght axis — every weight
// rendered identically (the font's default axis position, typically 400).

interface FontEntry { family: string, src?: string, data?: BufferSource, weight?: number, style?: string, cacheKey?: string }

interface DedupedFontLoad {
  binaryKey: string
  family: string
  style?: string
  data: BufferSource
  weight: number | undefined
}

function dedupeFontsByBinary(fonts: FontEntry[]): DedupedFontLoad[] {
  const byBinary = new Map<string, { family: string, style?: string, data: BufferSource, weights: Set<number | undefined> }>()
  for (const font of fonts) {
    if (!font.data)
      continue
    const binaryKey = `${font.family}|${font.style || 'normal'}|${font.src || ''}`
    const existing = byBinary.get(binaryKey)
    if (existing) {
      existing.weights.add(font.weight)
    }
    else {
      byBinary.set(binaryKey, {
        family: font.family,
        style: font.style,
        data: font.data,
        weights: new Set([font.weight]),
      })
    }
  }
  const result: DedupedFontLoad[] = []
  for (const [binaryKey, entry] of byBinary) {
    const isVariable = entry.weights.size > 1
    result.push({
      binaryKey,
      family: entry.family,
      style: entry.style,
      data: entry.data,
      weight: isVariable ? undefined : [...entry.weights][0],
    })
  }
  return result
}

const sharedBuffer = new Uint8Array([1, 2, 3, 4])

describe('dedupeFontsByBinary', () => {
  it('collapses variable-font entries sharing a src into a single load with no weight', () => {
    const weights = [400, 500, 600, 700, 800, 900]
    const fonts = weights.map(weight => ({
      family: 'Public Sans',
      style: 'normal',
      weight,
      src: '/_fonts/public-sans-variable.woff2',
      data: sharedBuffer,
    }))

    const deduped = dedupeFontsByBinary(fonts)

    expect(deduped).toHaveLength(1)
    expect(deduped[0]).toMatchObject({
      family: 'Public Sans',
      style: 'normal',
      weight: undefined,
    })
  })

  it('keeps static per-weight binaries as separate loads with explicit weights', () => {
    const fonts = [
      { family: 'Inter', style: 'normal', weight: 400, src: '/inter-400.ttf', data: new Uint8Array([1]) },
      { family: 'Inter', style: 'normal', weight: 700, src: '/inter-700.ttf', data: new Uint8Array([2]) },
    ]

    const deduped = dedupeFontsByBinary(fonts)

    expect(deduped).toHaveLength(2)
    expect(deduped.map(d => d.weight).sort()).toEqual([400, 700])
  })

  it('treats different styles of the same family/src as separate loads', () => {
    const fonts = [
      { family: 'Public Sans', style: 'normal', weight: 400, src: '/variable.woff2', data: sharedBuffer },
      { family: 'Public Sans', style: 'normal', weight: 700, src: '/variable.woff2', data: sharedBuffer },
      { family: 'Public Sans', style: 'italic', weight: 400, src: '/variable-italic.woff2', data: sharedBuffer },
      { family: 'Public Sans', style: 'italic', weight: 700, src: '/variable-italic.woff2', data: sharedBuffer },
    ]

    const deduped = dedupeFontsByBinary(fonts)

    expect(deduped).toHaveLength(2)
    const styles = deduped.map(d => d.style).sort()
    expect(styles).toEqual(['italic', 'normal'])
    for (const entry of deduped)
      expect(entry.weight).toBeUndefined()
  })

  it('skips entries without data', () => {
    const fonts = [
      { family: 'X', weight: 400, src: '/x.ttf' },
      { family: 'X', weight: 400, src: '/x.ttf', data: new Uint8Array([1]) },
    ]

    expect(dedupeFontsByBinary(fonts)).toHaveLength(1)
  })

  it('preserves the binaryKey shape so state.loadedFontKeys can dedupe across requests', () => {
    const fonts = [
      { family: 'Public Sans', style: 'normal', weight: 400, src: '/variable.woff2', data: sharedBuffer },
    ]

    const deduped = dedupeFontsByBinary(fonts)

    expect(deduped[0]!.binaryKey).toBe('Public Sans|normal|/variable.woff2')
  })
})
