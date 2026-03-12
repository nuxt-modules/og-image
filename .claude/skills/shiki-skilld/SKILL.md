---
name: shiki-skilld
description: "ALWAYS use when writing code importing \"shiki\". Consult for debugging, best practices, or modifying shiki."
metadata:
  version: 4.0.0
  generated_by: Claude Code · Haiku 4.5
  generated_at: 2026-02-28
---

# shikijs/shiki `shiki`

**Version:** 4.0.0 (Feb 2026)
**Deps:** @shikijs/vscode-textmate@^10.0.2, @types/hast@^3.0.4, @shikijs/core@4.0.0, @shikijs/engine-oniguruma@4.0.0, @shikijs/langs@4.0.0, @shikijs/engine-javascript@4.0.0, @shikijs/themes@4.0.0, @shikijs/types@4.0.0
**Tags:** next: 0.9.4 (May 2021), latest: 4.0.0 (Feb 2026)

**References:** [package.json](./.skilld/pkg/package.json) — exports, entry points • [README](./.skilld/pkg/README.md) — setup, basic usage • [Docs](./.skilld/docs/_INDEX.md) — API reference, guides • [GitHub Issues](./.skilld/issues/_INDEX.md) — bugs, workarounds, edge cases • [GitHub Discussions](./.skilld/discussions/_INDEX.md) — Q&A, patterns, recipes • [Releases](./.skilld/releases/_INDEX.md) — changelog, breaking changes, new APIs

## Search

Use `skilld search` instead of grepping `.skilld/` directories — hybrid semantic + keyword search across all indexed docs, issues, and releases. If `skilld` is unavailable, use `npx -y skilld search`.

```bash
skilld search "query" -p shiki
skilld search "issues:error handling" -p shiki
skilld search "releases:deprecated" -p shiki
```

Filters: `docs:`, `issues:`, `releases:` prefix narrows by source type.

## API Changes

This section documents version-specific API changes — prioritize recent major/minor releases.

### Breaking Changes in v4.0.0

- BREAKING: Node.js 18 support dropped — shiki v4 requires Node.js ≥ 20 (v18 reached EOL April 2025) [source](./.skilld/docs/blog/v4.md:L13:17)

- BREAKING: `CreatedBundledHighlighterOptions` interface removed (typo fix) — use `CreateBundledHighlighterOptions` instead [source](./.skilld/docs/blog/v4.md:L21:28)

- BREAKING: `createdBundledHighlighter` function removed (typo fix) — use `createBundledHighlighter` instead [source](./.skilld/docs/blog/v4.md:L30:37)

- BREAKING: `theme` option removed from `TwoslashFloatingVue` — use `themes` object with light/dark keys instead [source](./.skilld/docs/blog/v4.md:L39:48)

- BREAKING: CSS class `twoslash-query-presisted` removed (misspelled) — use correct class name `twoslash-query-persisted` [source](./.skilld/docs/blog/v4.md:L50:52)

- NEW: `@shikijs/markdown-exit` package — modern TypeScript markdown parser with native async rendering support for Shiki, replaces `markdown-it-shikiji` [source](./.skilld/releases/v4.0.0.md:L16)

- NEW: `@shikijs/primitive` package — leaner core package for minimal bundle footprint [source](./.skilld/releases/v4.0.0.md:L15)

### Breaking Changes from v3 → v4 Migration

- BREAKING: `theme` option for `createHighlighter()` dropped — pass `themes` array instead, theme required for every `codeToHtml`/`codeToTokens` call [source](./.skilld/docs/guide/migrate.md:L44:45)

- BREAKING: Highlighter no longer maintains internal default theme context — must explicitly pass `theme` option to `codeToHtml()` and `codeToTokens()` [source](./.skilld/docs/guide/migrate.md:L45)

- BREAKING: `codeToThemedTokens()` renamed to `codeToTokensBase()` — higher-level `codeToTokens()` replaces old API [source](./.skilld/docs/guide/migrate.md:L46)

- BREAKING: `.ansiToHtml()` merged into `.codeToHtml()` — use `.codeToHtml(code, { lang: 'ansi' })` instead [source](./.skilld/docs/guide/migrate.md:L48)

- BREAKING: `lineOptions` option removed — use fully customizable `transforms` option instead [source](./.skilld/docs/guide/migrate.md:L49)

- BREAKING: `BUNDLED_LANGUAGES` and `BUNDLED_THEMES` moved and renamed — import `bundledLanguages` and `bundledThemes` from `@shikijs/langs` and `@shikijs/themes` respectively [source](./.skilld/docs/guide/migrate.md:L43)

**Also changed:** `LanguageRegistration` grammar field flattened · Top-level exports `setCDN`, `loadLanguage`, `loadTheme`, `setWasm` dropped · `codeToTokens` default `includeExplanation` set to `false`

# Best Practices

- Cache the highlighter instance at the module level and reuse it for multiple highlighting operations instead of creating new instances repeatedly — the highlighter is expensive to initialize, and explicitly call `dispose()` when no longer needed to free WebAssembly resources [source](./.skilld/docs/guide/best-performance.md#cache-the-highlighter-instance)

- Avoid importing `shiki`, `shiki/bundle/full`, or `shiki/bundle/web` directly for web applications — use fine-grained imports like `shiki/core`, `shiki/engine/javascript`, `@shikijs/langs/typescript`, and `@shikijs/themes/dark-plus` to control bundle size and startup time [source](./.skilld/docs/guide/best-performance.md#fine-grained-bundle)

- Use shorthands like `codeToHtml()` for asynchronous highlighting workflows where themes and languages can be loaded on demand, avoiding the upfront overhead of initializing all themes and languages at startup [source](./.skilld/docs/guide/best-performance.md#use-shorthands)

- Prefer `createHighlighterCore()` with explicit engine selection (JavaScript or Oniguruma) over the bundled `createHighlighter()` when bundling for web to maintain fine-grained control over dependencies and bundle size [source](./.skilld/docs/guide/best-performance.md#fine-grained-bundle)

- Render dual or multiple themes by passing a `themes` object with named keys to `codeToHtml()` — Shiki generates CSS variables for each theme, allowing you to switch themes via CSS selectors or media queries without re-highlighting [source](./.skilld/docs/guide/dual-themes.md#lightdark-dual-themes)

- Use `codeToHast()` instead of `codeToHtml()` when you need to apply additional transformations or integrate with unified ecosystem plugins — you get the intermediate hast AST without HTML serialization [source](./.skilld/docs/api.md#codetohast)

- Apply transformers with `enforce: 'pre'` or `enforce: 'post'` to guarantee ordering when multiple transformers need to execute in a specific sequence for correct results [source](./.skilld/docs/guide/transformers.md#enforcing-transformer-ordering)

- Use `codeToHast()` once to get the grammar state, then pass it to `getLastGrammarState(root)` to extract cached state — avoids double-highlighting when you need to compute grammar context for code snippets or pausable highlighting [source](./.skilld/docs/guide/grammar-state.md#get-grammar-state-from-hast)

- Use the JavaScript regex engine (`createJavaScriptRegexEngine()`) for browser bundling and constrained environments — it avoids the large Oniguruma WebAssembly dependency and achieves better startup performance for most languages [source](./.skilld/docs/guide/regex-engines.md#javascript-regexp-engine)

- Create custom shorthands with `createBundledHighlighter()` and `createSingletonShorthands()` to generate fine-grained bundles tailored to your language and theme needs — allows deferred loading without bundling all languages upfront [source](./.skilld/docs/guide/shorthands.md#create-shorthands-with-fine-grained-bundles)

# Best Practices

- Cache the highlighter instance at the module level and reuse it for multiple highlighting operations instead of creating new instances repeatedly — the highlighter is expensive to initialize, and explicitly call `dispose()` when no longer needed to free WebAssembly resources [source](./.skilld/docs/guide/best-performance.md#cache-the-highlighter-instance)

- Avoid importing `shiki`, `shiki/bundle/full`, or `shiki/bundle/web` directly for web applications — use fine-grained imports like `shiki/core`, `shiki/engine/javascript`, `@shikijs/langs/typescript`, and `@shikijs/themes/dark-plus` to control bundle size and startup time [source](./.skilld/docs/guide/best-performance.md#fine-grained-bundle)

- Use shorthands like `codeToHtml()` for asynchronous highlighting workflows where themes and languages can be loaded on demand, avoiding the upfront overhead of initializing all themes and languages at startup [source](./.skilld/docs/guide/best-performance.md#use-shorthands)

- Prefer `createHighlighterCore()` with explicit engine selection (JavaScript or Oniguruma) over the bundled `createHighlighter()` when bundling for web to maintain fine-grained control over dependencies and bundle size [source](./.skilld/docs/guide/best-performance.md#fine-grained-bundle)

- Render dual or multiple themes by passing a `themes` object with named keys to `codeToHtml()` — Shiki generates CSS variables for each theme, allowing you to switch themes via CSS selectors or media queries without re-highlighting [source](./.skilld/docs/guide/dual-themes.md#lightdark-dual-themes)

- Use `codeToHast()` instead of `codeToHtml()` when you need to apply additional transformations or integrate with unified ecosystem plugins — you get the intermediate hast AST without HTML serialization [source](./.skilld/docs/api.md#codetohast)

- Apply transformers with `enforce: 'pre'` or `enforce: 'post'` to guarantee ordering when multiple transformers need to execute in a specific sequence for correct results [source](./.skilld/docs/guide/transformers.md#enforcing-transformer-ordering)

- Use `codeToHast()` once to get the grammar state, then pass it to `getLastGrammarState(root)` to extract cached state — avoids double-highlighting when you need to compute grammar context for code snippets or pausable highlighting [source](./.skilld/docs/guide/grammar-state.md#get-grammar-state-from-hast)

- Use the JavaScript regex engine (`createJavaScriptRegexEngine()`) for browser bundling and constrained environments — it avoids the large Oniguruma WebAssembly dependency and achieves better startup performance for most languages [source](./.skilld/docs/guide/regex-engines.md#javascript-regexp-engine)

- Create custom shorthands with `createBundledHighlighter()` and `createSingletonShorthands()` to generate fine-grained bundles tailored to your language and theme needs — allows deferred loading without bundling all languages upfront [source](./.skilld/docs/guide/shorthands.md#create-shorthands-with-fine-grained-bundles)
