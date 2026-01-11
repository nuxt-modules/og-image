# Takumi Renderer Implementation Plan

## Overview

Takumi is a Rust-based image rendering engine that directly rasterizes to PNG/JPEG/WebP without SVG intermediates. It's 2-10x faster than Satori+Resvg and has native Tailwind support.

## Package Info
- Main package: `@takumi-rs/image-response`
- Node binding: `@takumi-rs/core` (napi-rs)
- WASM binding: `@takumi-rs/wasm`
- JSX helpers: `@takumi-rs/helpers`

## Takumi vs Satori Comparison

| Feature | Satori | Takumi |
|---------|--------|--------|
| Output | SVG → Raster (via Resvg) | Direct Raster |
| Speed | Baseline | 2-10x faster |
| Tailwind | Via UnoCSS/custom parser | Built-in native |
| Fonts | Manual loading | Built-in Geist (Node), manual WASM |
| RTL | Limited | Native support |
| Variable Fonts | No | Yes |
| COLR Emoji | No | Yes |
| Display Inline | No | Yes |
| Bindings | Node + WASM | Node (napi-rs) + WASM |

## Key Architectural Differences

### Satori Pipeline (current)
```
Vue Component → HTML → VNodes (satori-html) → SVG (satori) → PNG (resvg/sharp)
```

### Takumi Pipeline (proposed)
```
Vue Component → HTML → Takumi Nodes (linkedom parse) → PNG/JPEG/WebP (takumi)
```

**Critical difference:** Takumi expects its own node format, not HTML. We use linkedom to parse HTML into DOM, then convert to Takumi nodes. This is similar to how satori-html converts HTML to Satori VNodes.

### Why Not Use Takumi's fromJsx?
Takumi provides `fromJsx` helper for JSX→Node conversion, but:
1. Our templates are Vue components, not JSX
2. We already have the HTML rendering pipeline
3. HTML→Node conversion is more flexible and reuses existing transforms

### Rendering Flow Comparison

```
SATORI:
┌──────────────┐    ┌──────────────┐    ┌─────────┐    ┌──────────┐
│ Vue Template │───>│ satori-html  │───>│ Satori  │───>│ Resvg/   │──> PNG
│    (HTML)    │    │  (VNodes)    │    │  (SVG)  │    │ Sharp    │
└──────────────┘    └──────────────┘    └─────────┘    └──────────┘

TAKUMI:
┌──────────────┐    ┌──────────────┐    ┌─────────────────────────┐
│ Vue Template │───>│  linkedom    │───>│        Takumi           │──> PNG/JPEG/WebP
│    (HTML)    │    │ (TakumiNode) │    │ (direct rasterization)  │
└──────────────┘    └──────────────┘    └─────────────────────────┘
```

Key advantage: Takumi skips the SVG intermediate, going directly to raster output.

## Takumi Node Format

Takumi uses three node types (JSON-serializable):

```typescript
// Container - groups/layouts nodes
{
  children: Node[],
  style?: Style,
  tw?: string
}

// Text - displays text
{
  text: string,
  style?: Style,
  tw?: string
}

// Image - displays images
{
  src: string,
  width?: number,
  height?: number,
  style?: Style,
  tw?: string
}
```

## Installation Requirements

```bash
# Core package
pnpm add @takumi-rs/image-response

# For low-level API
pnpm add @takumi-rs/core @takumi-rs/helpers
```

### pnpm Hoisting (required)
```ini
# .npmrc
public-hoist-pattern[]=@takumi-rs/core-*
```

## Implementation Files

### 1. `src/runtime/server/og-image/takumi/renderer.ts`

Main renderer implementation (modeled after satori/renderer.ts):

```typescript
import type { OgImageRenderEventContext, Renderer, ResolvedFontConfig } from '../../../types'
import { fontCache } from '#og-image-cache'
import { defu } from 'defu'
import { sendError } from 'h3'
import { normaliseFontInput } from '../../../shared'
import { useOgImageRuntimeConfig } from '../../utils'
import { loadFont } from '../satori/font' // reuse font loading
import { useTakumi } from './instances'
import { createTakumiNodes } from './nodes'

const fontPromises: Record<string, Promise<ResolvedFontConfig>> = {}

async function resolveFonts(event: OgImageRenderEventContext) {
  const { fonts } = useOgImageRuntimeConfig()
  const normalisedFonts = normaliseFontInput([...event.options.fonts || [], ...fonts])
  const localFontPromises: Promise<ResolvedFontConfig>[] = []
  const preloadedFonts: ResolvedFontConfig[] = []

  if (fontCache) {
    for (const font of normalisedFonts) {
      if (await fontCache.hasItem(font.cacheKey)) {
        font.data = (await fontCache.getItemRaw(font.cacheKey)) || undefined
        preloadedFonts.push(font)
      }
      else {
        if (!fontPromises[font.cacheKey]) {
          fontPromises[font.cacheKey] = loadFont(event, font).then(async (_font) => {
            if (_font?.data)
              await fontCache?.setItemRaw(_font.cacheKey, _font.data)
            return _font
          })
        }
        localFontPromises.push(fontPromises[font.cacheKey]!)
      }
    }
  }
  const awaitedFonts = await Promise.all(localFontPromises)
  return [...preloadedFonts, ...awaitedFonts].map(_f => ({
    name: _f.name,
    data: _f.data,
  }))
}

// Cache renderer instance for performance
let _takumiRenderer: any

async function getTakumiRenderer(fonts: Array<{ name: string, data?: BufferSource }>) {
  if (_takumiRenderer) return _takumiRenderer
  const { Renderer } = await useTakumi()
  _takumiRenderer = new Renderer({ fonts: fonts.filter(f => f.data) })
  return _takumiRenderer
}

async function createImage(event: OgImageRenderEventContext, format: 'png' | 'jpeg' | 'webp') {
  const { options } = event

  const [nodes, fonts] = await Promise.all([
    createTakumiNodes(event),
    resolveFonts(event),
  ])

  await event._nitro.hooks.callHook('nuxt-og-image:takumi:nodes', nodes, event)

  const renderer = await getTakumiRenderer(fonts)

  return renderer.render(nodes, defu(options.takumi, {
    width: options.width!,
    height: options.height!,
    format,
  })).catch((err: Error) => sendError(event.e, err, import.meta.dev))
}

const TakumiRenderer: Renderer = {
  name: 'takumi',
  supportedFormats: ['png', 'jpeg', 'jpg', 'webp'],

  async createImage(e) {
    switch (e.extension) {
      case 'png':
        return createImage(e, 'png')
      case 'jpeg':
      case 'jpg':
        return createImage(e, 'jpeg')
      // webp not in standard extensions but could be added
    }
  },

  async debug(e) {
    const nodes = await createTakumiNodes(e)
    return { nodes }
  },
}

export default TakumiRenderer
```

### 2. `src/runtime/server/og-image/takumi/nodes.ts`

HTML to Takumi node converter (mirrors satori/vnodes.ts flow):

```typescript
import type { OgImageRenderEventContext } from '../../../types'
import { parseHTML } from 'linkedom'
import { htmlDecodeQuotes } from '../../util/encoding'
import { fetchIsland } from '../../util/kit'
import { applyEmojis } from '../satori/transforms/emojis'
import { applyInlineCss } from '../satori/transforms/inlineCss'

export interface TakumiNode {
  children?: TakumiNode[]
  text?: string
  src?: string
  width?: number
  height?: number
  style?: Record<string, any>
  tw?: string
}

export async function createTakumiNodes(ctx: OgImageRenderEventContext): Promise<TakumiNode> {
  let html = ctx.options.html
  if (!html) {
    const island = await fetchIsland(ctx.e, ctx.options.component!, typeof ctx.options.props !== 'undefined' ? ctx.options.props : ctx.options)
    island.html = htmlDecodeQuotes(island.html)
    // reuse satori transforms for inline CSS and emojis
    await applyInlineCss(ctx, island)
    await applyEmojis(ctx, island)
    html = island.html
    if (html?.includes('<body>')) {
      html = html.match(/<body>([\s\S]*)<\/body>/)?.[1] || ''
    }
  }

  // Wrap in root container with dimensions
  const template = `<div style="position: relative; display: flex; margin: 0 auto; width: ${ctx.options.width}px; height: ${ctx.options.height}px; overflow: hidden;">${html}</div>`

  const { document } = parseHTML(template)
  const root = document.body.firstElementChild || document.body

  return elementToNode(root as Element, ctx)
}

async function elementToNode(el: Element, ctx: OgImageRenderEventContext): Promise<TakumiNode> {
  const tagName = el.tagName.toLowerCase()

  // Handle images
  if (tagName === 'img') {
    const src = el.getAttribute('src') || ''
    return {
      src: await resolveImageSrc(src, ctx),
      width: Number(el.getAttribute('width')) || undefined,
      height: Number(el.getAttribute('height')) || undefined,
      tw: el.getAttribute('class') || undefined,
      style: parseStyleAttr(el.getAttribute('style')),
    }
  }

  // Handle SVG - convert to data URI
  if (tagName === 'svg') {
    const svgString = el.outerHTML
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`
    return {
      src: dataUri,
      width: Number(el.getAttribute('width')) || undefined,
      height: Number(el.getAttribute('height')) || undefined,
    }
  }

  // Handle text-only elements
  if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
    return {
      text: el.textContent || '',
      tw: el.getAttribute('class') || undefined,
      style: parseStyleAttr(el.getAttribute('style')),
    }
  }

  // Handle containers
  const children: TakumiNode[] = []
  for (const child of el.childNodes) {
    if (child.nodeType === 1) {
      children.push(await elementToNode(child as Element, ctx))
    }
    else if (child.nodeType === 3 && child.textContent?.trim()) {
      children.push({ text: child.textContent.trim() })
    }
  }

  return {
    children: children.length ? children : undefined,
    tw: el.getAttribute('class') || undefined,
    style: parseStyleAttr(el.getAttribute('style')),
  }
}

async function resolveImageSrc(src: string, ctx: OgImageRenderEventContext): Promise<string> {
  // Already a data URI or absolute URL
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://'))
    return src

  // Relative path - resolve against base
  if (src.startsWith('/')) {
    // Could fetch and convert to base64 for embedding
    // For now, return as-is and let Takumi handle it
    return src
  }

  return src
}

function parseStyleAttr(style: string | null): Record<string, any> | undefined {
  if (!style) return undefined
  const result: Record<string, any> = {}
  for (const decl of style.split(';')) {
    const [prop, ...valParts] = decl.split(':')
    const val = valParts.join(':').trim() // handle URLs with colons
    if (prop?.trim() && val) {
      result[camelCase(prop.trim())] = val
    }
  }
  return Object.keys(result).length ? result : undefined
}

function camelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}
```

### 3. `src/runtime/server/og-image/takumi/instances.ts`

Lazy-loading takumi binding:

```typescript
let _takumi: { Renderer: any } | undefined

export async function useTakumi() {
  if (_takumi) return _takumi
  const binding = await import('#og-image/bindings/takumi')
  await binding.initPromise
  _takumi = binding
  return _takumi
}
```

### 4. Bindings Structure

Similar to Satori bindings pattern:

#### `src/runtime/server/og-image/bindings/takumi/node.ts`
```typescript
import { Renderer } from '@takumi-rs/core'

export { Renderer }
export const initPromise = Promise.resolve()
```

#### `src/runtime/server/og-image/bindings/takumi/wasm.ts`
```typescript
import { Renderer, init } from '@takumi-rs/wasm'

// Dynamic import of WASM module
const wasmBinary = import('@takumi-rs/wasm/wasm?module' as string)
  .then(m => m.default || m)

export { Renderer }
export const initPromise = wasmBinary.then(wasm => init(wasm))
```

### 5. Type Updates

#### `src/runtime/types.ts`

Changes at specific lines:

```diff
# Line 121 - OgImageOptions.renderer
- renderer?: 'chromium' | 'satori'
+ renderer?: 'chromium' | 'satori' | 'takumi'

# Line ~132 - Add after sharp option
  sharp?: SharpOptions & JpegOptions
+ takumi?: {
+   format?: 'png' | 'jpeg' | 'webp'
+   persistentImages?: Array<{ src: string, data: ArrayBuffer }>
+ }

# Line 168-175 - RuntimeCompatibilitySchema - add takumi
  satori: 'node' | 'wasm' | 'wasm-fs' | false
+ takumi: 'node' | 'wasm' | false
  sharp: 'node' | false

# Line 188 - Renderer.name
- name: 'chromium' | 'satori'
+ name: 'chromium' | 'satori' | 'takumi'
```

### 6. Instances Registration

#### `src/runtime/server/og-image/instances.ts`

Add to existing file:

```diff
  import type ChromiumRenderer from './chromium/renderer'
  import type SatoriRenderer from './satori/renderer'
+ import type TakumiRenderer from './takumi/renderer'

  const satoriRendererInstance: { instance?: typeof SatoriRenderer } = { instance: undefined }
  const chromiumRendererInstance: { instance?: typeof ChromiumRenderer } = { instance: undefined }
+ const takumiRendererInstance: { instance?: typeof TakumiRenderer } = { instance: undefined }

  // ... existing functions ...

+ export async function useTakumiRenderer() {
+   takumiRendererInstance.instance = takumiRendererInstance.instance
+     || await import('#og-image/renderers/takumi').then(m => m.default)
+   return takumiRendererInstance.instance!
+ }
```

### 7. Context Resolution

#### `src/runtime/server/og-image/context.ts`

Changes:

```diff
  import type ChromiumRenderer from './chromium/renderer'
  import type SatoriRenderer from './satori/renderer'
+ import type TakumiRenderer from './takumi/renderer'
- import { useChromiumRenderer, useSatoriRenderer } from './instances'
+ import { useChromiumRenderer, useSatoriRenderer, useTakumiRenderer } from './instances'

  // Line ~146-154 - Add takumi case
- let renderer: ((typeof SatoriRenderer | typeof ChromiumRenderer) & { __mock__?: true }) | undefined
+ let renderer: ((typeof SatoriRenderer | typeof ChromiumRenderer | typeof TakumiRenderer) & { __mock__?: true }) | undefined
  switch (options.renderer) {
    case 'satori':
      renderer = await useSatoriRenderer()
      break
    case 'chromium':
      renderer = await useChromiumRenderer()
      break
+   case 'takumi':
+     renderer = await useTakumiRenderer()
+     break
  }
```

### 8. Compatibility Setup

#### `src/compatibility.ts`

Add takumi to RuntimeCompatibility configs and applyNitroPresetCompatibility:

```diff
# Line 28-35 - NodeRuntime - add takumi
  export const NodeRuntime: RuntimeCompatibilitySchema = {
    'chromium': 'on-demand',
    'css-inline': 'node',
    'resvg': 'node',
    'satori': 'node',
+   'takumi': 'node',
    'sharp': 'node',
  }

# Line 37-47 - cloudflare - add takumi
  const cloudflare: RuntimeCompatibilitySchema = {
    'chromium': false,
    'css-inline': false,
    'resvg': 'wasm',
    'satori': 'node',
+   'takumi': 'wasm',
    'sharp': false,
    'wasm': { esmImport: true, lazy: true },
  }

# Line 48-54 - awsLambda - add takumi
  const awsLambda: RuntimeCompatibilitySchema = {
    'chromium': false,
    'css-inline': 'wasm',
    'resvg': 'node',
    'satori': 'node',
+   'takumi': 'node',
    'sharp': false,
  }

# Line 56-62 - WebContainer - add takumi
  export const WebContainer: RuntimeCompatibilitySchema = {
    'chromium': false,
    'css-inline': 'wasm-fs',
    'resvg': 'wasm-fs',
    'satori': 'wasm-fs',
+   'takumi': 'wasm',
    'sharp': false,
  }

# Line ~143-148 in applyNitroPresetCompatibility - add renderer alias
  const satoriEnabled = ...
  const chromiumEnabled = ...
+ const takumiEnabled = typeof options.compatibility?.takumi !== 'undefined'
+   ? !!options.compatibility.takumi
+   : !!compatibility.takumi

  nitroConfig.alias!['#og-image/renderers/satori'] = satoriEnabled ? ... : emptyMock
  nitroConfig.alias!['#og-image/renderers/chromium'] = chromiumEnabled ? ... : emptyMock
+ nitroConfig.alias!['#og-image/renderers/takumi'] = takumiEnabled
+   ? await resolve.resolvePath('./runtime/server/og-image/takumi/renderer')
+   : emptyMock

# Line ~166-173 in applyBinding - add takumi binding
  nitroConfig.alias = defu(
    await applyBinding('chromium'),
    await applyBinding('satori'),
+   await applyBinding('takumi'),
    await applyBinding('resvg'),
    await applyBinding('sharp'),
    await applyBinding('css-inline'),
    nitroConfig.alias || {},
  )
```

### 9. Module Configuration

#### `src/module.ts`

```typescript
// Add takumi to optionalDependencies check
if (isProviderEnabledForEnv('takumi', nuxt, config)) {
  ensurePackageInstalled('@takumi-rs/core')
  ensurePackageInstalled('@takumi-rs/image-response')
}
```

## Font Handling

### Node.js Runtime
Takumi includes Geist and Geist Mono by default in Node.js. No font loading needed for basic usage.

### Custom Fonts
```typescript
const fonts = [{
  name: 'Inter',
  data: await fetch('/fonts/Inter.woff2').then(r => r.arrayBuffer()),
}]

const renderer = new Renderer({ fonts })
```

### Font Caching
Takumi uses WeakSet internally for font caching. Declare fonts at module scope for best performance:

```typescript
// fonts.ts
let _fonts: Font[] | undefined

export async function getFonts(): Promise<Font[]> {
  if (_fonts) return _fonts
  _fonts = await loadFonts()
  return _fonts
}
```

## Renderer Instance Caching

For optimal performance, reuse the Renderer instance across requests:

```typescript
let _renderer: InstanceType<typeof Renderer> | undefined

async function getRenderer() {
  if (_renderer) return _renderer
  const { Renderer } = await import('#og-image/bindings/takumi')
  const fonts = await getFonts()
  _renderer = new Renderer({ fonts })
  return _renderer
}
```

## Output Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| PNG | .png | Default, lossless |
| JPEG | .jpeg/.jpg | Lossy, smaller size |
| WebP | .webp | Modern, best compression |
| APNG | N/A | Animated PNG (future?) |

## Tailwind Integration

Takumi has native Tailwind support via `tw` prop. No external Tailwind/UnoCSS needed:

```typescript
{
  tw: 'bg-blue-500 p-4 rounded-lg text-white',
  children: [
    { text: 'Hello', tw: 'text-2xl font-bold' }
  ]
}
```

**Limitation:** No custom theme configuration - uses default Tailwind values. Arbitrary values work: `tw: 'p-[20px] bg-[#ff0000]'`

## Migration Considerations

### From Satori
1. Replace UnoCSS classes → Tailwind classes (mostly compatible)
2. Remove Satori-specific plugins
3. Handle unsupported features (some CSS properties may differ)

### Template Compatibility
Current Vue templates work if:
- Using standard Tailwind classes
- Using inline styles
- Not relying on Satori-specific workarounds

## Edge Runtime Support

Takumi WASM works in:
- Cloudflare Workers
- Vercel Edge Functions
- Netlify Edge Functions
- Deno Deploy

```typescript
import { initWasm, Renderer } from '@takumi-rs/wasm'

// Initialize once
await initWasm()

// Create ImageResponse
new ImageResponse(<Component />, { width: 1200, height: 630 })
```

## Performance Considerations

1. **Reuse Renderer instance** - avoid creating per-request
2. **Cache fonts at module scope** - loaded once, reused
3. **Use persistentImages** - for logos/icons used across images
4. **Prefer Node.js binding** - faster than WASM, supports parallelism
5. **WebP format** - smaller files, faster delivery

## Potential Challenges

### 1. HTML → Node Conversion
Current templates render to HTML. Need reliable conversion to Takumi's node format. Options:
- Parse HTML with linkedom/cheerio
- Intercept before HTML generation (at VNode level)
- Use Takumi's JSX helpers if adaptable

### 2. Style Compatibility
Some CSS properties may behave differently:
- Flexbox/Grid edge cases
- Text overflow handling
- Image sizing

### 3. Emoji Handling
Takumi supports COLR emoji fonts natively. May need to bundle emoji font or use system fonts.

### 4. Font Fallbacks
Unlike Satori's automatic Google Font loading, Takumi requires explicit font bundles. Need to implement similar fallback mechanism.

## Testing Strategy

1. **Unit tests** - HTML to node conversion
2. **Visual regression** - Compare output against Satori
3. **Performance benchmarks** - Measure speed improvement
4. **Edge runtime tests** - WASM in Cloudflare/Vercel

## Implementation Order

1. Add types and interfaces
2. Create node conversion utility
3. Implement renderer with Node.js binding
4. Wire up instances/context/compatibility
5. Add WASM binding for edge runtimes
6. Test with existing templates
7. Add takumi-specific options
8. Documentation

## Open Questions

1. Should Takumi be default renderer or opt-in?
2. How to handle templates using Satori-specific features?
3. Include Geist fonts for WASM or require user fonts?
4. Support animated output (APNG/WebP)?

## UnoCSS vs Tailwind Consideration

Current codebase uses UnoCSS heavily for class processing. Takumi has native Tailwind support but **no custom theme**.

**Options:**
1. **Keep UnoCSS processing** - Convert UnoCSS output to inline styles before HTML→Node conversion
2. **Use Takumi's Tailwind** - Pass classes via `tw` prop, rely on Tailwind defaults
3. **Hybrid** - Use inline styles for custom theme values, `tw` for standard classes

**Recommendation:** Option 1 (keep UnoCSS) for maximum compatibility with existing templates. The `applyInlineCss` transform already converts classes to inline styles which Takumi can parse.

## Files to Create/Modify Summary

### New Files (4)
| File | Purpose |
|------|---------|
| `src/runtime/server/og-image/takumi/renderer.ts` | Main renderer |
| `src/runtime/server/og-image/takumi/nodes.ts` | HTML→Takumi node converter |
| `src/runtime/server/og-image/bindings/takumi/node.ts` | Node.js binding |
| `src/runtime/server/og-image/bindings/takumi/wasm.ts` | WASM binding |

### Modified Files (4)
| File | Changes |
|------|---------|
| `src/runtime/types.ts` | Add takumi types |
| `src/runtime/server/og-image/instances.ts` | Add useTakumiRenderer |
| `src/runtime/server/og-image/context.ts` | Add takumi switch case |
| `src/compatibility.ts` | Add takumi to all runtime configs |

### Dependencies
```bash
pnpm add @takumi-rs/core @takumi-rs/wasm
```

## Quick Start Test

After implementation, test with:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  ogImage: {
    defaults: {
      renderer: 'takumi'
    }
  }
})
```

Or per-page:
```vue
<script setup>
defineOgImage({
  renderer: 'takumi',
  component: 'MyOgImage',
})
</script>
```
