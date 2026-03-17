---
name: vitest-skilld
description: "ALWAYS use when writing code importing \"vitest\". Consult for debugging, best practices, or modifying vitest."
metadata:
  version: 4.1.0
  generated_at: 2026-03-16
---

# vitest-dev/vitest `vitest`

**Version:** 4.1.0 (Mar 2026)
**Deps:** es-module-lexer@^2.0.0, expect-type@^1.3.0, magic-string@^0.30.21, obug@^2.1.1, pathe@^2.0.3, picomatch@^4.0.3, std-env@^4.0.0-rc.1, tinybench@^2.9.0, tinyexec@^1.0.2, tinyglobby@^0.2.15, tinyrainbow@^3.0.3, vite@^6.0.0 || ^7.0.0 || ^8.0.0-0, why-is-node-running@^2.3.0, @vitest/expect@4.1.0, @vitest/mocker@4.1.0, @vitest/runner@4.1.0, @vitest/snapshot@4.1.0, @vitest/pretty-format@4.1.0, @vitest/spy@4.1.0, @vitest/utils@4.1.0
**Tags:** latest: 4.1.0 (Mar 2026), beta: 4.1.0-beta.6 (Mar 2026)

**References:** [package.json](./.skilld/pkg/package.json) — exports, entry points • [README](./.skilld/pkg/README.md) — setup, basic usage • [Docs](./.skilld/docs/_INDEX.md) — API reference, guides • [GitHub Issues](./.skilld/issues/_INDEX.md) — bugs, workarounds, edge cases • [GitHub Discussions](./.skilld/discussions/_INDEX.md) — Q&A, patterns, recipes • [Releases](./.skilld/releases/_INDEX.md) — changelog, breaking changes, new APIs

## Search

Use `skilld search` instead of grepping `.skilld/` directories — hybrid semantic + keyword search across all indexed docs, issues, and releases. If `skilld` is unavailable, use `npx -y skilld search`.

```bash
skilld search "query" -p vitest
skilld search "issues:error handling" -p vitest
skilld search "releases:deprecated" -p vitest
```

Filters: `docs:`, `issues:`, `releases:` prefix narrows by source type.

<!-- skilld:api-changes -->
## API Changes

This section documents version-specific API changes — prioritize recent major/minor releases.

### Breaking Changes v4.0

- BREAKING: `test()` and `describe()` third argument — options must be the second argument, not third [source](./.skilld/docs/guide/migration.md:L491:L502)

- BREAKING: Pool configuration options restructured — `maxThreads`/`maxForks` → `maxWorkers`, `singleThread`/`singleFork` → `maxWorkers: 1, isolate: false`, `poolOptions` removed, `vmMemoryLimit` replaces nested config [source](./.skilld/docs/guide/migration.md:L328:L356)

- BREAKING: `@vitest/browser/context` and `@vitest/browser/utils` moved — import from `vitest/browser` instead [source](./.skilld/docs/guide/migration.md:L298:L316)

- BREAKING: Browser provider now accepts factory function instead of string — `provider: 'playwright'` → `provider: playwright({ launchOptions: {...} })` [source](./.skilld/docs/guide/migration.md:L266:L293)

- BREAKING: `workspace` config option renamed to `projects` — move code from `vitest.workspace.js` to `vitest.config.ts` [source](./.skilld/docs/guide/migration.md:L230:L264)

- BREAKING: Module environment now uses `viteEnvironment` property instead of `transformMode` [source](./.skilld/docs/guide/migration.md:L222)

- BREAKING: `vi.fn().getMockName()` returns `'vi.fn()'` by default instead of `'spy'` — affects snapshots with mock names [source](./.skilld/releases/v4.0.0.md:L156)

- BREAKING: `vi.restoreAllMocks` no longer resets automocks — only restores manual `vi.spyOn` spies [source](./.skilld/releases/v4.0.0.md:L157)

- BREAKING: Coverage `coverage.all` and `coverage.extensions` removed — use `coverage.include` to specify source file pattern [source](./.skilld/docs/guide/migration.md:L34:L77)

- BREAKING: Verbose reporter now prints as flat list — use `'tree'` reporter for previous hierarchical output [source](./.skilld/docs/guide/migration.md:L438:L447)

- BREAKING: Removed deprecated config options — `poolMatchGlobs`, `environmentMatchGlobs`, `deps.external`, `deps.inline`, `deps.fallbackCJS` replaced with `projects` and `server.deps.*` [source](./.skilld/docs/guide/migration.md:L486:L488)

- BREAKING: Snapshots with custom elements now include shadow root contents — set `printShadowRoot: false` to restore previous behavior [source](./.skilld/docs/guide/migration.md:L449:L480)

### New Features v4.0

- NEW: `vi.spyOn()` and `vi.fn()` support constructors — can now spy on and mock constructor functions with `new` keyword [source](./.skilld/releases/v4.0.0.md:L121)

- NEW: `toMatchScreenshot()` for visual regression testing in browser mode [source](./.skilld/releases/v4.0.0.md:L69)

- NEW: `toBeInViewport()` browser utility to assert element visibility [source](./.skilld/releases/v4.0.0.md:L67)

- NEW: `onUnhandledError` callback hook for handling unhandled errors [source](./.skilld/releases/v4.0.0.md:L48)

- NEW: `onConsoleLog` callback now receives `entity` parameter [source](./.skilld/releases/v4.0.0.md:L47)

- NEW: `expect.assert()` for type narrowing in assertions [source](./.skilld/releases/v4.0.0.md:L55)

- NEW: Custom screenshot comparison algorithms support in browser mode [source](./.skilld/releases/v4.0.0.md:L76)

- NEW: Module Runner replaces vite-node — provides `moduleRunner` instance injected into test runners instead of `__vitest_executor` [source](./.skilld/docs/guide/migration.md:L215:L228)

- NEW: API method `enableCoverage()` and `disableCoverage()` for dynamic coverage control [source](./.skilld/releases/v4.0.0.md:L62)

- NEW: API method `getGlobalTestNamePattern()` to access current test name filter [source](./.skilld/releases/v4.0.0.md:L63)

- NEW: API method `getSeed()` to retrieve random seed value [source](./.skilld/releases/v4.0.0.md:L65)

- NEW: `experimental_parseSpecifications` API for parsing test specifications [source](./.skilld/releases/v4.0.0.md:L60)

### Deprecation & Removal

- DEPRECATED: Reporter APIs `onCollected`, `onSpecsCollected`, `onPathsCollected`, `onTaskUpdate`, `onFinished` — migrate to new reporter API [source](./.skilld/docs/guide/migration.md:L424)

- DEPRECATED: `--browser.provider` CLI option removed [source](./.skilld/releases/v4.0.16.md:L16)

- DEPRECATED: `test.poolOptions` config — use top-level options instead [source](./.skilld/releases/v4.0.16.md:L16)

**Also changed:** `vi.mockObject()` adds `spy` option · `recordArtifact()` exported from vitest package · `toBeNullable()` matcher · Module graph UI fixes in HTML reporter · Playwright tracing support · Separate browser provider packages (`@vitest/browser-playwright`, etc.)
<!-- /skilld:api-changes -->

<!-- skilld:best-practices -->
## Best Practices

- Disable test isolation selectively with `isolate: false` for projects without side effects or that properly cleanup state — reduces test run time by eliminating per-file VM/worker overhead [source](./.skilld/docs/guide/improving-performance.md#test-isolation)

- Use `context.expect` instead of global `expect` when running concurrent snapshot tests — ensures each test's snapshots are tracked independently and prevents conflicts [source](./.skilld/docs/guide/test-context.md#expect)

- Define test tags in configuration to apply shared options (timeout, retry, priority) to grouped tests — enables filtering and automatic configuration without repeating test options [source](./.skilld/docs/guide/test-tags.md#defining-tags)

- Return a cleanup function from `beforeEach` instead of using `afterEach` — simpler syntax and keeps setup/teardown logic in one place [source](./.skilld/docs/api/hooks.md#beforeeach)

```ts
beforeEach(() => {
  const resource = setupResource()
  return () => resource.cleanup()
})
```

- Use dynamic `import()` syntax with `vi.mock` for better TypeScript support and IDE integration — allows the compiler to validate the module path and type the `importOriginal` helper [source](./.skilld/docs/api/vi.md#vi-mock)

- Use `vi.hoisted` to declare variables referenced in `vi.mock` factories — allows bypassing the hoisting limitation and referencing setup code [source](./.skilld/docs/api/vi.md#vi-mock)

- Choose the `threads` pool over `forks` for larger projects to improve test run time — threads pool is faster for parallelization on multi-core machines [source](./.skilld/docs/guide/improving-performance.md#pool)

- Await `importOriginal()` inside mock factories to properly handle async module loading — mock factory receives an async helper that must be awaited to access the real module [source](./.skilld/docs/guide/mocking/modules.md#mocking-a-module)

- Apply retry conditions to tests with transient failures using regex or function-based matching — enables automatic retry only for specific error patterns without blanket retries [source](./.skilld/docs/config/retry.md#condition)
<!-- /skilld:best-practices -->
