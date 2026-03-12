---
name: resvg-resvg-js-skilld
description: "ALWAYS use when writing code importing \"@resvg/resvg-js\". Consult for debugging, best practices, or modifying @resvg/resvg-js, resvg/resvg-js, resvg resvg-js, resvg resvg js, resvg-js, resvg js."
metadata:
  version: 2.6.2
  generated_by: Claude Code · Haiku 4.5
  generated_at: 2026-03-02
---

# thx/resvg-js `@resvg/resvg-js`

**Version:** 2.6.2 (Mar 2024)
**Tags:** latest: 2.6.2 (Mar 2024), next: 2.7.0-alpha.2 (Jan 2026)

**References:** [package.json](./.skilld/pkg/package.json) — exports, entry points • [README](./.skilld/pkg/README.md) — setup, basic usage • [Docs](./.skilld/docs/_INDEX.md) — API reference, guides • [GitHub Issues](./.skilld/issues/_INDEX.md) — bugs, workarounds, edge cases • [Releases](./.skilld/releases/_INDEX.md) — changelog, breaking changes, new APIs

## Search

Use `skilld search` instead of grepping `.skilld/` directories — hybrid semantic + keyword search across all indexed docs, issues, and releases. If `skilld` is unavailable, use `npx -y skilld search`.

```bash
skilld search "query" -p @resvg/resvg-js
skilld search "issues:error handling" -p @resvg/resvg-js
skilld search "releases:deprecated" -p @resvg/resvg-js
```

Filters: `docs:`, `issues:`, `releases:` prefix narrows by source type.

## API Changes

This section documents version-specific API changes — prioritize recent major/minor releases.

### Breaking Changes (v2.0.0 major redesign)

- BREAKING: Class-based API replaces function export in v2.0.0 — old code `const { render } = require('@resvg/resvg-js')` must change to `const { Resvg } = require('@resvg/resvg-js')` then `new Resvg(svg, opts).render()` [source](./.skilld/releases/v2.0.0.md#20-0-0)

- BREAKING: `render()` returns `RenderResult` object in v2.0.0, not raw Buffer — use `.asPng()` to get PNG data, access `.width` and `.height` properties [source](./.skilld/releases/CHANGELOG.md:L378:380)

- BREAKING: Font loading logic changed significantly in v2.4.0 (resvg 0.28.0 upgrade) — fonts loaded via `defaultFontFamily` option require updated handling due to upstream resvg redesign [source](./.skilld/releases/v2.4.0.md#changed)

### New APIs Added

- NEW: `fontBuffers` option in v2.5.0 enables loading custom fonts directly in Wasm via `font: { fontBuffers: [buffer] }` — now supports WOFF2 format [source](./.skilld/releases/v2.5.0.md:L31)

- NEW: `.pixels()` method in v2.2.0 returns raw PNG pixel data instead of only `.asPng()` buffer [source](./.skilld/releases/v2.2.0.md:L36)

- NEW: `imagesToResolve()` and `resolveImage(url)` APIs in v2.1.0 load remote PNG/JPEG/GIF images from HTTP(S) URLs [source](./.skilld/releases/v2.1.0.md#added)

- NEW: `innerBBox()` API in v2.1.0 returns bounding box of all visible elements in SVG (note: path bbox values are approximate) [source](./.skilld/releases/v2.1.0.md#added)

- NEW: `getBBox()` API in v2.1.0 mirrors browser `SVGGraphicsElement.getBBox()` — applies transform calculations and returns exact BBox but does not calculate BBoxes with stroke correctly [source](./.skilld/releases/v2.1.0.md#added)

- NEW: `cropByBBox(bbox)` API in v2.1.0 crops PNG bitmap by bounding box — accepts either `getBBox()` or `innerBBox()` result [source](./.skilld/releases/v2.1.0.md#added)

- NEW: `.width` and `.height` properties in v2.0.0 on Resvg instance return original SVG dimensions [source](./.skilld/releases/CHANGELOG.md:L413)

### Behavioral Changes

- BREAKING: Text rendering now uses quadratic Bézier curves in v2.6.0 (resvg 0.34.0 upgrade) instead of converting TrueType font curves to cubic — text may render slightly differently (often better) [source](./.skilld/releases/v2.6.0.md:L16)

- BREAKING: `defaultFontFamily` option became optional in v2.5.0 — library now auto-detects font family from loaded fonts, but setting it explicitly remains supported [source](./.skilld/releases/v2.5.0.md:L15)

- CHANGED: Error code `UnrecognizedBuffer` renamed to `UnsupportedImage` in v2.2.0 — update error handling that checks error codes [source](./.skilld/releases/v2.2.0.md:L273)

### Utility APIs

- NEW: `.toString()` method in v2.0.0 converts SVG shapes and text to path data (only available after `new Resvg(svg)` construction) [source](./.skilld/releases/CHANGELOG.md:L414)

- NEW: WebAssembly support in v2.0.0 allows rendering in browser and Web Workers — use `@resvg/resvg-wasm` package with `new resvg.Resvg(svg)` pattern matching Node.js API [source](./.skilld/releases/v2.0.0.md#added)

**Also changed:** `getBBox()` returns `undefined` if bbox invalid · Wasm file added to exports in v2.3.0 · resvg upgraded from 0.29.0 to 0.34.0 in v2.6.0 · Deno native support in v2.2.0

## Best Practices

- Disable `loadSystemFonts` when not needed for faster rendering — defaults to true which loads all system fonts, causing unnecessary overhead. Explicitly set to false if you provide custom fonts. [source](./.skilld/issues/issue-289.md:L38)

- Import WASM module as `import wasm from '@resvg/resvg-wasm/index_bg.wasm'` rather than passing a URL string to `initWasm()` — avoids `TypeError: Invalid URL string` in bundlers like Vite, webpack, and Cloudflare Workers. [source](./.skilld/issues/issue-288.md:L40)

- In Next.js/Remix, add `@resvg/resvg-js` to `experimental.serverComponentsExternalPackages` to avoid webpack loader errors with native `.node` files — prevents "No loader is configured" errors on both x64 and ARM platforms. [source](./.skilld/issues/issue-198.md:L32:41)

- Use `fontBuffers` to load custom fonts in WASM, including WOFF2 format — available since v2.5.0, enables consistent text rendering across Node.js and browser environments. The library now auto-detects the default font family from loaded fonts. [source](./.skilld/releases/v2.5.0.md:L31)

- Call `imagesToResolve()` before render, then `resolveImage(href, buffer)` for each external image — necessary to load PNG, JPEG, and GIF images embedded in SVGs (only works for `xlink:href` starting with `http://` or `https://`). [source](./.skilld/releases/v2.1.0.md:L11:15)

- Use `fitTo: { mode: 'width', value: number }` or `{ mode: 'height', value: number }` to scale while preserving aspect ratio — `original` mode skips scaling, `zoom` applies a direct multiplier. These modes affect the final output dimensions. [source](./.skilld/docs/index.md) and `./.skilld/pkg/`

- Prefer `getBBox()` over `innerBBox()` for DOM-compatible bounding boxes — `getBBox()` applies SVG transforms (matching DOM API), while `innerBBox()` ignores transforms. Both may return undefined for invalid SVGs. [source](./.skilld/releases/v2.1.0.md:L27:31)

- Use `renderAsync(svg, options, signal)` instead of synchronous render for server-side applications — supports AbortSignal for cancellation, crucial for timeout handling in Next.js API routes and Remix loaders. [source](./.skilld/docs/index.md) and TypeScript definition

- Set `shapeRendering`, `textRendering`, and `imageRendering` options to 0 (optimizeSpeed), 1, or 2 (geometricPrecision) to balance quality vs performance — mode 2 provides highest quality at cost of speed, useful for critical visual content. [source](./.skilld/pkg/`)`

- Understand that `dpi` option is NOT the DPI value written to PNG metadata — it's used internally for scaling calculations. Use it to adjust rendering resolution relative to viewBox without needing to modify SVG dimensions. [source](./.skilld/releases/v2.2.0.md:L47)

- Call `.pixels()` on RenderedImage to access raw RGBA pixel buffer for direct pixel processing — faster than converting to PNG for headless scenarios where you only need pixel data, not file output. [source](./.skilld/releases/v2.2.0.md:L35:36)
