---
name: takumi-rs-core-skilld
description: "ALWAYS use when writing code importing \"@takumi-rs/core\". Consult for debugging, best practices, or modifying @takumi-rs/core, takumi-rs/core, takumi-rs core, takumi rs core, takumi."
metadata:
  version: 0.68.17
  generated_by: Claude Code · Haiku 4.5
  generated_at: 2026-02-24
---

# kane50613/takumi `@takumi-rs/core`

**Version:** 0.68.17 (Feb 2026)
**Tags:** latest: 0.68.17 (Feb 2026)

**References:** [package.json](./.skilld/pkg/package.json) — exports, entry points • [README](./.skilld/pkg/README.md) — setup, basic usage • [Docs](./.skilld/docs/_INDEX.md) — API reference, guides • [GitHub Issues](./.skilld/issues/_INDEX.md) — bugs, workarounds, edge cases • [GitHub Discussions](./.skilld/discussions/_INDEX.md) — Q&A, patterns, recipes • [Releases](./.skilld/releases/_INDEX.md) — changelog, breaking changes, new APIs

## Search

Use `skilld search` instead of grepping `.skilld/` directories — hybrid semantic + keyword search across all indexed docs, issues, and releases. If `skilld` is unavailable, use `npx -y skilld search`.

```bash
skilld search "query" -p @takumi-rs/core
skilld search "issues:error handling" -p @takumi-rs/core
skilld search "releases:deprecated" -p @takumi-rs/core
```

Filters: `docs:`, `issues:`, `releases:` prefix narrows by source type.

## API Changes

This section documents version-specific API changes — prioritize recent major/minor releases.

- DEPRECATED: `putPersistentImageAsync()` — renamed to `putPersistentImage()` to align with sync/async naming conventions [source](./.skilld/pkg/index.d.ts:L45:46)

- DEPRECATED: `loadFontAsync()` — renamed to `loadFont()` to align with sync/async naming conventions [source](./.skilld/pkg/index.d.ts:L51:52)

- DEPRECATED: `loadFontsAsync()` — renamed to `loadFonts()` to align with sync/async naming conventions [source](./.skilld/pkg/index.d.ts:L55:56)

- DEPRECATED: `renderAsync()` — renamed to `render()` to align with sync/async naming conventions [source](./.skilld/pkg/index.d.ts:L63:64)

- DEPRECATED: `PersistentImage` type — use `ImageSource` instead [source](./.skilld/pkg/index.d.ts:L34:36)

- DEPRECATED: `OutputFormat` uppercase variants (`WebP`, `Jpeg`, `Png`) — use lowercase versions (`webp`, `jpeg`, `png`) instead [source](./.skilld/pkg/index.d.ts:L144:149)

- DEPRECATED: `purgeResourcesCache()` — this function does nothing and should not be called [source](./.skilld/pkg/index.d.ts:L41:42)

- DEPRECATED: `purgeFontCache()` — this function does nothing and should not be called [source](./.skilld/pkg/index.d.ts:L43:44)

**Also changed:** `loadFontSync()` added in v0.67.2 · `extractResourceUrls()` utility function available · `renderAnimation()` for multi-frame animations

## Best Practices

- Reuse Renderer instances across multiple render calls to avoid recreating resource management overhead — for Cloudflare Workers, initialize outside the fetch handler to prevent per-request re-initialization [source](./.skilld/docs/performance-and-optimization.mdx:L11-19)

- Preload frequently used images as persistent images to avoid redundant image decoding — register with `persistentImages` option and reference by key in `src` attributes [source](./.skilld/docs/load-images.mdx:L56-101)

- Prefer TTF font format over WOFF2 — TTF can be used directly while WOFF2 requires decompression, only use WOFF2 if file size matters more than performance [source](./.skilld/docs/performance-and-optimization.mdx:L69-73)

- Initialize WASM module via `initSync()` outside request handlers on Cloudflare Workers — prevents reinitializing on every request [source](./.skilld/docs/performance-and-optimization.mdx:L21-49)

- Pass `persistentImages` to Renderer constructor when using `renderAnimation()` to enable image access across animation frames [source](./.skilld/discussions/discussion-375.md)

- Use `extractResourceUrls()` and `fetchResources()` helpers for external images when working with `@takumi-rs/core` directly — provides manual control over resource loading [source](./.skilld/docs/load-images.mdx:L13-32)

- Stack CSS filters and blurs in a single node to minimize composition layer creation — each filter applied to separate nodes incurs additional memory overhead [source](./.skilld/docs/performance-and-optimization.mdx:L63-65)

- Call `renderer.measure(node)` to get layout dimensions without rendering — useful for calculating sizes for further layout decisions [source](./.skilld/docs/measure-api.mdx:L1-22)

- Use `fontVariationSettings` CSS property for variable fonts to control axes like weight and width — `font-weight` property has same effect as `fontVariationSettings: "wght" <weight>` [source](./.skilld/docs/typography-and-fonts.mdx:L37-49)

- Enable `drawDebugBorder: true` in ImageResponse options when debugging layout issues — draws borders around nodes to visualize layout structure [source](./.skilld/docs/troubleshooting.mdx:L10-24)
