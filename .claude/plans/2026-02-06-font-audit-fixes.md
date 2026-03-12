# Font Module Audit Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix duplicate code, add missing tests, simplify font pipeline, move all state to nuxt instance.

**Architecture:** Move module-level singleton (`fontlessContext`) and scattered state to a `nuxt._ogImageFontCtx` object. Inline `resolveStaticFonts` into `downloadStaticFonts`. Cache `parseFontsFromTemplate` result to avoid double call. Extract font-URL persistence from `convertWoff2ToTtf`. Share `/_fonts/` constant. Delete dead test file.

**Tech Stack:** TypeScript, Vitest, Nuxt module internals

---

### Task 1: Delete dead test file

**Files:**
- Delete: `test/unit/fonts-migration.test.ts`

**Step 1: Delete the file**
```bash
rm test/unit/fonts-migration.test.ts
```

**Step 2: Run tests to confirm nothing breaks**
```bash
pnpm vitest run test/unit/
```
Expected: All pass, no reference to fonts-migration.

**Step 3: Commit**
```bash
git add test/unit/fonts-migration.test.ts
git commit -m "chore: delete dead fonts-migration test file"
```

---

### Task 2: Add `/_fonts/` constant and use everywhere

**Files:**
- Modify: `src/build/fonts.ts`
- Modify: `src/build/fontless.ts`

**Step 1: Add constant to `src/build/fonts.ts`**

Add after the `ParsedFont` interface (~line 26):
```ts
/** Shared font URL prefix used by both build and runtime font resolution */
export const FONTS_URL_PREFIX = '/_fonts'
```

Update `parseFontsFromTemplate` line 183:
```ts
// before
? `/_fonts/${woff2Filename.replace('.woff2', '.ttf')}`
// after
? `${FONTS_URL_PREFIX}/${woff2Filename.replace('.woff2', '.ttf')}`
```

Update `copyTtfFontsToOutput` line 249:
```ts
// before
const outputDir = join(outputPublicDir, '_fonts')
// after
const outputDir = join(outputPublicDir, FONTS_URL_PREFIX.slice(1))
```

**Step 2: Update `src/build/fontless.ts`**

Import the constant:
```ts
import { downloadFontFile, fontKey, FONTS_URL_PREFIX, getStaticInterFonts, matchesFontRequirements, parseFontsFromTemplate } from './fonts'
```

Update `initFontless` line 84:
```ts
assetsBaseURL: FONTS_URL_PREFIX,
```

Update `resolveMissingFontFamilies` lines 329/332:
```ts
src: `${FONTS_URL_PREFIX}/${f.filename}`,
satoriSrc: `${FONTS_URL_PREFIX}/${f.filename}`,
```

**Step 3: Run typecheck**
```bash
pnpm vitest run test/unit/
```

**Step 4: Commit**
```bash
git add src/build/fonts.ts src/build/fontless.ts
git commit -m "refactor: share FONTS_URL_PREFIX constant"
```

---

### Task 3: Move fontless singleton to nuxt instance, inline `resolveStaticFonts`

The fontless context is currently a module-level singleton (`let fontlessContext`). Move it to `nuxt._ogImageFontless` so it's tied to the nuxt lifecycle. Also inline `resolveStaticFonts` into `downloadStaticFonts` since it's the only caller.

**Files:**
- Modify: `src/build/fontless.ts`

**Step 1: Add nuxt-attached context type**

Replace the `FontlessContext` interface and singleton (lines 55-103) with:

```ts
interface FontlessContext {
  resolver: Resolver
  renderedFontURLs: Map<string, string>
}

function getFontlessContext(nuxt: Nuxt): FontlessContext | undefined {
  return (nuxt as any)._ogImageFontless
}

function setFontlessContext(nuxt: Nuxt, ctx: FontlessContext): void {
  (nuxt as any)._ogImageFontless = ctx
}

export async function initFontless(options: {
  nuxt: Nuxt
  logger?: ConsolaInstance
  userFamilies?: FontlessOptions['families']
}): Promise<void> {
  if (getFontlessContext(options.nuxt))
    return

  const renderedFontURLs = new Map<string, string>()

  const providers = {
    fontsource: unifontProviders.fontsource,
    google: unifontProviders.google,
    bunny: unifontProviders.bunny,
  } as Record<string, (opts: unknown) => any>

  const resolver = await createResolver({
    normalizeFontData: faces => normalizeFontData(
      {
        dev: false,
        renderedFontURLs,
        assetsBaseURL: FONTS_URL_PREFIX,
        callback: (filename, url) => renderedFontURLs.set(filename, url),
      },
      faces,
    ),
    logger: options.logger,
    options: {
      families: options.userFamilies,
      priority: ['fontsource', 'google', 'bunny'],
      defaults: {
        weights: [400, 700],
        styles: ['normal', 'italic'],
        subsets: ['latin'],
      },
    },
    providers,
  })

  setFontlessContext(options.nuxt, { resolver, renderedFontURLs })
}
```

**Step 2: Inline `resolveStaticFonts` into `downloadStaticFonts`**

Delete the exported `resolveStaticFonts` function entirely (lines 109-165) and the `detectFormat` helper (lines 167-177).

Update `downloadStaticFonts` to accept `nuxt` and do the resolution inline:

```ts
async function downloadStaticFonts(options: {
  families: { family: string, weights: number[], styles: Array<'normal' | 'italic'> }[]
  nuxt: Nuxt
  logger: ConsolaInstance
  filenameFromUrl?: boolean
}): Promise<DownloadedFont[]> {
  if (options.families.length === 0)
    return []

  const ttfDir = join(options.nuxt.options.buildDir, 'cache', 'og-image', 'fonts-ttf')
  fs.mkdirSync(ttfDir, { recursive: true })

  await initFontless({ nuxt: options.nuxt, logger: options.logger })
  const fontlessCtx = getFontlessContext(options.nuxt)
  if (!fontlessCtx) {
    options.logger.warn('fontless not initialized, cannot resolve static font fallbacks')
    return []
  }

  const results: DownloadedFont[] = []

  for (const { family, weights, styles } of options.families) {
    try {
      const resolution = await fontlessCtx.resolver(family, { name: family, weights, styles } as FontFamilyProviderOverride)
      if (!resolution?.fonts?.length) {
        options.logger.debug(`No fonts found for ${family} via fontless`)
        continue
      }

      for (const font of resolution.fonts) {
        const srcs = Array.isArray(font.src) ? font.src : [font.src]
        for (const src of srcs) {
          if (typeof src !== 'object' || !('url' in src))
            continue
          const url = src.url
          const format = src.format || (url.endsWith('.woff') ? 'woff' : url.endsWith('.ttf') ? 'truetype' : undefined)
          if (format !== 'truetype' && format !== 'woff')
            continue
          const weight = typeof font.weight === 'number' ? font.weight : 400
          const style = font.style || 'normal'
          if (!weights.includes(weight) || !styles.includes(style as 'normal' | 'italic'))
            continue

          const ext = format === 'truetype' ? 'ttf' : 'woff'
          const filename = options.filenameFromUrl
            ? (url.split('/').pop() || `${family}-${weight}.${ext}`).replace(/[^a-z0-9.-]/gi, '_')
            : `${family.replace(/[^a-z0-9]/gi, '_')}-${weight}-${style}.${ext}`

          const destPath = join(ttfDir, filename)
          if (!await downloadFontFile(url, destPath))
            continue

          results.push({ family, weight, style, format, filename })
          options.logger.debug(`Resolved static font: ${family} ${weight}`)
        }
      }
    }
    catch (err) {
      options.logger.debug(`Failed to resolve fallback font for ${family}:`, err)
    }
  }

  return results
}
```

**Step 3: Remove `ResolvedStaticFont` type** (no longer needed — was only used by `resolveStaticFonts`)

**Step 4: Update `convertWoff2ToTtf` and `resolveMissingFontFamilies`**

In `convertWoff2ToTtf`, change `downloadStaticFonts` call:
```ts
const downloaded = await downloadStaticFonts({
  families,
  nuxt,
  logger,
  filenameFromUrl: true,
})
```

In `resolveMissingFontFamilies`, add `nuxt` param and pass through:
```ts
export async function resolveMissingFontFamilies(options: {
  missingFamilies: string[]
  weights: number[]
  styles: Array<'normal' | 'italic'>
  nuxt: Nuxt
  logger: ConsolaInstance
}): Promise<ParsedFont[]> {
  const { missingFamilies, weights, styles, nuxt, logger } = options
  const families = missingFamilies.map(family => ({ family, weights, styles }))
  const downloaded = await downloadStaticFonts({ families, nuxt, logger })
  // ... rest unchanged
```

**Step 5: Update `resolveOgImageFonts` to pass `nuxt` to `resolveMissingFontFamilies`**

```ts
const additionalFonts = await resolveMissingFontFamilies({
  missingFamilies,
  weights: fontRequirements.weights,
  styles: fontRequirements.styles,
  nuxt,
  logger,
})
```

**Step 6: Run tests + typecheck**
```bash
pnpm vitest run test/unit/
```

**Step 7: Commit**
```bash
git add src/build/fontless.ts
git commit -m "refactor: move fontless context to nuxt instance, inline resolveStaticFonts"
```

---

### Task 4: Extract font-URL persistence from `convertWoff2ToTtf`

Move the `renderedFontURLs` JSON persistence (lines 239-243) out of `convertWoff2ToTtf` into a standalone function called from `module.ts` instead. This makes `convertWoff2ToTtf` focused on its one job.

**Files:**
- Modify: `src/build/fontless.ts`
- Modify: `src/module.ts`

**Step 1: Create `persistFontUrlMapping` in fontless.ts**

Add a new exported function:
```ts
export function persistFontUrlMapping(options: {
  fontContext: { renderedFontURLs: Map<string, string> } | null
  buildDir: string
  logger: ConsolaInstance
}): void {
  if (!options.fontContext?.renderedFontURLs.size)
    return
  const cacheDir = join(options.buildDir, 'cache', 'og-image')
  fs.mkdirSync(cacheDir, { recursive: true })
  const mapping = Object.fromEntries(options.fontContext.renderedFontURLs)
  fs.writeFileSync(join(cacheDir, 'font-urls.json'), JSON.stringify(mapping))
  options.logger.debug(`Persisted ${options.fontContext.renderedFontURLs.size} font URLs for prerender`)
}
```

**Step 2: Remove from `convertWoff2ToTtf`**

Remove `fontContext` from `ProcessFontsOptions` and delete lines 239-243 from `convertWoff2ToTtf`. Also remove the now-unnecessary `cacheDir` creation at line 236.

Update `ProcessFontsOptions`:
```ts
export interface ProcessFontsOptions {
  nuxt: Nuxt
  logger: ConsolaInstance
  fontRequirements: FontRequirementsState
  convertedWoff2Files: Set<string>
  fontSubsets?: string[]
}
```

**Step 3: Call `persistFontUrlMapping` from module.ts**

In `module.ts` at the `vite:compiled` hook (~line 1175), add the persistence call before `convertWoff2ToTtf`:
```ts
nuxt.hook('vite:compiled', async () => {
  if (fontProcessingDone || !hasSatoriRenderer())
    return
  persistFontUrlMapping({ fontContext, buildDir: nuxt.options.buildDir, logger })
  await scanFontRequirementsLazy()
  await convertWoff2ToTtf({
    nuxt,
    logger,
    fontRequirements: fontRequirementsState,
    convertedWoff2Files,
    fontSubsets: config.fontSubsets,
  })
  fontProcessingDone = true
})
```

Update import in module.ts:
```ts
import { convertWoff2ToTtf, persistFontUrlMapping, resolveOgImageFonts } from './build/fontless'
```

**Step 4: Run tests**
```bash
pnpm vitest run test/unit/
```

**Step 5: Commit**
```bash
git add src/build/fontless.ts src/module.ts
git commit -m "refactor: extract font-URL persistence from convertWoff2ToTtf"
```

---

### Task 5: Cache `parseFontsFromTemplate` on nuxt instance

`parseFontsFromTemplate` is called twice on the satori path: once in `convertWoff2ToTtf` and once in `resolveOgImageFonts`. Cache on the nuxt instance.

**Files:**
- Modify: `src/build/fonts.ts`

**Step 1: Add caching wrapper**

Replace `parseFontsFromTemplate` with a cached version using a nuxt-attached cache key:

```ts
export async function parseFontsFromTemplate(
  nuxt: Nuxt,
  options: {
    convertedWoff2Files: Set<string>
    fontSubsets?: string[]
  },
): Promise<ParsedFont[]> {
  // Cache key based on convertedWoff2Files size (changes after WOFF2 processing)
  const cacheKey = `parsedFonts:${options.convertedWoff2Files.size}:${[...options.convertedWoff2Files].sort().join(',')}`
  const cache = ((nuxt as any)._ogImageParsedFontsCache ||= new Map<string, ParsedFont[]>())
  const cached = cache.get(cacheKey)
  if (cached)
    return cached

  // ... existing implementation ...

  cache.set(cacheKey, result)
  return result
}
```

Keep the actual parsing logic identical, just wrap with cache lookup/store.

**Step 2: Run tests**
```bash
pnpm vitest run test/unit/
```

**Step 3: Commit**
```bash
git add src/build/fonts.ts
git commit -m "perf: cache parseFontsFromTemplate result on nuxt instance"
```

---

### Task 6: Add unit tests for `fontKey` and `matchesFontRequirements`

**Files:**
- Modify: `test/unit/fonts.test.ts`

**Step 1: Write tests**

Add to `test/unit/fonts.test.ts`:

```ts
import { fontKey, getStaticInterFonts, matchesFontRequirements } from '../../src/build/fonts'
```

Update the existing import to include these.

Add test suites:

```ts
describe('fontKey', () => {
  it('generates key from family, weight, style', () => {
    expect(fontKey({ family: 'Inter', weight: 400, style: 'normal' }))
      .toBe('Inter-400-normal-default')
  })

  it('includes unicode range when present', () => {
    expect(fontKey({ family: 'Inter', weight: 400, style: 'normal', unicodeRange: 'U+0-FF' }))
      .toBe('Inter-400-normal-U+0-FF')
  })

  it('uses "default" for missing unicode range', () => {
    expect(fontKey({ family: 'Inter', weight: 700, style: 'italic' }))
      .toBe('Inter-700-italic-default')
  })

  it('differentiates by weight', () => {
    const k1 = fontKey({ family: 'Inter', weight: 400, style: 'normal' })
    const k2 = fontKey({ family: 'Inter', weight: 700, style: 'normal' })
    expect(k1).not.toBe(k2)
  })
})

describe('matchesFontRequirements', () => {
  const req = { weights: [400, 700], styles: ['normal' as const, 'italic' as const], families: [] as string[] }

  it('matches when weight and style match', () => {
    expect(matchesFontRequirements({ weight: 400, style: 'normal', family: 'Inter' }, req)).toBe(true)
  })

  it('rejects unmatched weight', () => {
    expect(matchesFontRequirements({ weight: 300, style: 'normal', family: 'Inter' }, req)).toBe(false)
  })

  it('rejects unmatched style', () => {
    expect(matchesFontRequirements({ weight: 400, style: 'oblique', family: 'Inter' }, req)).toBe(false)
  })

  it('matches any family when families is empty', () => {
    expect(matchesFontRequirements({ weight: 400, style: 'normal', family: 'Anything' }, req)).toBe(true)
  })

  it('filters by family when families is set', () => {
    const reqWithFamilies = { ...req, families: ['Inter'] }
    expect(matchesFontRequirements({ weight: 400, style: 'normal', family: 'Inter' }, reqWithFamilies)).toBe(true)
    expect(matchesFontRequirements({ weight: 400, style: 'normal', family: 'Roboto' }, reqWithFamilies)).toBe(false)
  })
})

describe('getStaticInterFonts', () => {
  it('returns two Inter fonts at 400 and 700', () => {
    const fonts = getStaticInterFonts()
    expect(fonts).toHaveLength(2)
    expect(fonts[0].family).toBe('Inter')
    expect(fonts[0].weight).toBe(400)
    expect(fonts[0].satoriSrc).toBeDefined()
    expect(fonts[1].weight).toBe(700)
    expect(fonts[1].satoriSrc).toBeDefined()
  })
})
```

**Step 2: Run tests**
```bash
pnpm vitest run test/unit/fonts.test.ts
```
Expected: All pass.

**Step 3: Commit**
```bash
git add test/unit/fonts.test.ts
git commit -m "test: add unit tests for fontKey, matchesFontRequirements, getStaticInterFonts"
```

---

### Task 7: Add unit tests for `resolveOgImageFonts` branch logic

**Files:**
- Create: `test/unit/resolve-og-fonts.test.ts`

This tests the orchestrator's branching: no fonts → Inter fallback, all variable → warn, non-satori passthrough, etc. Mock `parseFontsFromTemplate` via `vi.mock`.

**Step 1: Write tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import { getStaticInterFonts } from '../../src/build/fonts'

// Mock parseFontsFromTemplate to avoid needing real nuxt instance
vi.mock('../../src/build/fonts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/build/fonts')>()
  return {
    ...mod,
    parseFontsFromTemplate: vi.fn().mockResolvedValue([]),
  }
})

const { resolveOgImageFonts } = await import('../../src/build/fontless')
const { parseFontsFromTemplate } = await import('../../src/build/fonts')

const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn() } as any
const baseFontReqs = { weights: [400, 700], styles: ['normal' as const], families: [], isComplete: true, componentMap: {} }
const baseOpts = {
  nuxt: { options: { buildDir: '/tmp/test', rootDir: '/tmp' } } as any,
  hasNuxtFonts: true,
  hasSatoriRenderer: false,
  convertedWoff2Files: new Set<string>(),
  fontRequirements: baseFontReqs,
  tw4FontVars: {},
  logger: mockLogger,
}

describe('resolveOgImageFonts', () => {
  it('returns Inter fallback when no fonts and no @nuxt/fonts', async () => {
    const fonts = await resolveOgImageFonts({ ...baseOpts, hasNuxtFonts: false })
    const inter = getStaticInterFonts()
    expect(fonts).toEqual(inter)
  })

  it('returns parsed fonts for non-satori renderer', async () => {
    const mockFonts = [{ family: 'Inter', src: '/test.woff2', weight: 400, style: 'normal' }]
    vi.mocked(parseFontsFromTemplate).mockResolvedValueOnce(mockFonts)
    const fonts = await resolveOgImageFonts({ ...baseOpts })
    expect(fonts).toEqual(mockFonts)
  })

  it('returns Inter fallback for satori with no fonts', async () => {
    vi.mocked(parseFontsFromTemplate).mockResolvedValueOnce([])
    const fonts = await resolveOgImageFonts({ ...baseOpts, hasSatoriRenderer: true, hasNuxtFonts: false })
    expect(fonts[0].family).toBe('Inter')
  })

  it('warns and appends Inter when all fonts are variable (no satoriSrc)', async () => {
    const variableFont = { family: 'Inter', src: '/inter.woff2', weight: 400, style: 'normal' }
    vi.mocked(parseFontsFromTemplate).mockResolvedValueOnce([variableFont])
    const fonts = await resolveOgImageFonts({ ...baseOpts, hasSatoriRenderer: true })
    expect(mockLogger.warn).toHaveBeenCalled()
    expect(fonts.some(f => f.satoriSrc)).toBe(true) // Inter fallback has satoriSrc
  })
})
```

**Step 2: Run tests**
```bash
pnpm vitest run test/unit/resolve-og-fonts.test.ts
```

**Step 3: Commit**
```bash
git add test/unit/resolve-og-fonts.test.ts
git commit -m "test: add resolveOgImageFonts branch logic tests"
```

---

### Execution Order

Tasks 1, 2, 6 are independent and can be parallelized.
Task 3 depends on Task 2 (needs the constant).
Task 4 depends on Task 3 (signature changes).
Task 5 is independent of 3/4.
Task 7 depends on Task 3 (mocks updated signatures).

```
[1] ──┐
[2] ──┼── [3] ── [4] ── [7]
[6] ──┘
[5] (independent)
```
