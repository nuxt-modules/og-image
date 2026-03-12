---
name: satori-skilld
description: "ALWAYS use when writing code importing \"satori\". Consult for debugging, best practices, or modifying satori."
metadata:
  version: 0.25.0
  generated_by: Claude Code · Haiku 4.5
  generated_at: 2026-03-12
---

# vercel/satori `satori`

**Version:** 0.25.0 (Mar 2026)
**Deps:** @shuding/opentype.js@1.4.0-beta.0, css-background-parser@^0.1.0, css-box-shadow@1.0.0-3, css-gradient-parser@^0.0.17, css-to-react-native@^3.0.0, emoji-regex-xs@^2.0.1, escape-html@^1.0.3, linebreak@^1.1.0, parse-css-color@^0.2.1, postcss-value-parser@^4.2.0, yoga-layout@^3.2.1
**Tags:** beta: 0.0.30-beta.1 (Aug 2022), latest: 0.25.0 (Mar 2026)

**References:** [package.json](./.skilld/pkg/package.json) — exports, entry points • [README](./.skilld/pkg/README.md) — setup, basic usage • [Docs](./.skilld/docs/_INDEX.md) — API reference, guides • [GitHub Issues](./.skilld/issues/_INDEX.md) — bugs, workarounds, edge cases • [GitHub Discussions](./.skilld/discussions/_INDEX.md) — Q&A, patterns, recipes • [Releases](./.skilld/releases/_INDEX.md) — changelog, breaking changes, new APIs

## Search

Use `skilld search` instead of grepping `.skilld/` directories — hybrid semantic + keyword search across all indexed docs, issues, and releases. If `skilld` is unavailable, use `npx -y skilld search`.

```bash
skilld search "query" -p satori
skilld search "issues:error handling" -p satori
skilld search "releases:deprecated" -p satori
```

Filters: `docs:`, `issues:`, `releases:` prefix narrows by source type.

<!-- skilld:api-changes -->
## API Changes

This section documents version-specific API changes across recent minor and patch releases (v0.13.0 through v0.19.2).

- BREAKING: `satori/wasm` entrypoint removed in v0.16.0 — library now always inlines WASM binary in lib source, no manual WASM configuration needed [source](./.skilld/releases/v0.16.0.md)

- NEW: `pointScaleFactor` option in `SatoriOptions` — v0.14.0 added option to scale point values for rendering [source](./.skilld/releases/v0.14.0.md)

- NEW: `text-wrap: "pretty"` CSS value — v0.13.0 added support for prettier text wrapping behavior [source](./.skilld/releases/v0.13.0.md)

- NEW: CSS layout properties in v0.16.0 — `box-sizing`, `display: contents`, `position: static`, `align-content: space-evenly`, and percentage values for `gap` now supported via yoga-layout upgrade [source](./.skilld/releases/v0.16.0.md)

- NEW: `object-fit` CSS property for images — v0.18.0 added support for image fitting options (cover, contain, fill, etc.) [source](./.skilld/releases/v0.18.0.md)

- NEW: Standalone build mode — v0.18.0 introduced capability to provide WASM binary manually via `init()` for environments that need custom WASM loading [source](./.skilld/releases/v0.18.0.md)

- NEW: Color gradients in `backgroundImage` — v0.19.0 added support for semi-transparent gradient colors in background images [source](./.skilld/releases/v0.19.0.md)

- NEW: `text-decoration-style: double` — v0.15.0 added support for double underline/overline/line-through styles [source](./.skilld/releases/v0.15.0.md)

- NEW: WebAssembly instance passing to `init()` — v0.18.2 now accepts pre-instantiated `WebAssembly.Instance` in addition to other input types [source](./.skilld/releases/v0.18.2.md)

- NEW: `text-decoration-skip-ink` CSS property — v0.19.1 added support for controlling decoration skipping around text descenders [source](./.skilld/releases/v0.19.1.md)

- NEW: `forwardRef` wrapped component support — v0.18.3 fixed component rendering for React components wrapped with `forwardRef` [source](./.skilld/releases/v0.18.3.md)

**Also changed:** `standalone` submodule `init()` function corrected v0.19.2 · performance improvements v0.18.1

**Note:** v0.25.0 is not documented in the release history. The latest documented version is v0.19.2 (2026-02-10). Breaking changes, new APIs, and signature modifications from v0.13.0 onwards are captured above.
<!-- /skilld:api-changes -->

<!-- skilld:best-practices -->
## Best Practices

- Reuse the `fonts` object across multiple satori calls to leverage the internal `fontCache` WeakMap — declaring fonts globally can double rendering performance [source](./.skilld/issues/issue-590.md:L47:68)

- Optimize font size by using WOFF format with limited charsets (e.g., Latin only) rather than full variable fonts, or serve fonts from `/public` and fetch on-demand [source](./.skilld/discussions/discussion-434.md:L21:26)

- Load variable fonts without specifying the `style` property to avoid OpenType parsing errors — use only `name` and `data` [source](./.skilld/issues/issue-162.md:L81:87)

- Use `flex-wrap: wrap` and `gap` properties when nesting `<span>` inside text to preserve proper text wrapping behavior [source](./.skilld/issues/issue-484.md:L44)

- Convert local images to data URIs instead of fetching from URLs to avoid network latency and edge-runtime restrictions [source](./.skilld/discussions/discussion-255.md:L20:22)

- Call the `init()` function before rendering to ensure the yoga layout engine WASM binary is loaded and available [source](./.skilld/pkg/./dist/index.d.ts:L138)

- Provide emoji support via the `graphemeImages` option in SatoriOptions to map specific graphemes to image URLs or base64-encoded data [source](./.skilld/discussions/discussion-307.md:L12:18)

- Use the `objectFit` property on `<img>` elements for consistent image scaling within constrained dimensions [source](./.skilld/releases/v0.18.0.md:L14)

- Apply `box-sizing: border-box` to simplify layout calculations and ensure padding/border dimensions are predictable [source](./.skilld/releases/v0.16.0.md:L11)

- Use `display: contents` to conditionally skip container rendering while preserving child layout — useful for conditional wrappers [source](./.skilld/releases/v0.16.0.md:L12)

- Avoid oklch color functions in `linear-gradient()` backgrounds — use rgb or hex colors instead as oklch parsing is not yet supported [source](./.skilld/issues/issue-637.md:L31)
<!-- /skilld:best-practices -->
