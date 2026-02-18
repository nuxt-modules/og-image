---
name: vitest-skilld
description: "ALWAYS use when writing code importing \"vitest\". Consult for debugging, best practices, or modifying vitest."
metadata:
  version: 4.0.18
  generated_by: Claude Code · Opus 4.6
---

# vitest-dev/vitest `vitest`

**Version:** 4.0.18 (Jan 2026)
**Deps:** es-module-lexer@^1.7.0, expect-type@^1.2.2, magic-string@^0.30.21, obug@^2.1.1, pathe@^2.0.3, picomatch@^4.0.3, std-env@^3.10.0, tinybench@^2.9.0, tinyexec@^1.0.2, tinyglobby@^0.2.15, tinyrainbow@^3.0.3, vite@^6.0.0 || ^7.0.0, why-is-node-running@^2.3.0, @vitest/mocker@4.0.18, @vitest/expect@4.0.18, @vitest/runner@4.0.18, @vitest/pretty-format@4.0.18, @vitest/snapshot@4.0.18, @vitest/spy@4.0.18, @vitest/utils@4.0.18
**Tags:** latest: 4.0.18 (Jan 2026), beta: 4.1.0-beta.4 (Feb 2026)

**References:** [package.json](./.skilld/pkg/package.json) — exports, entry points • [README](./.skilld/pkg/README.md) — setup, basic usage • [Docs](./.skilld/docs/_INDEX.md) — API reference, guides • [GitHub Issues](./.skilld/issues/_INDEX.md) — bugs, workarounds, edge cases • [GitHub Discussions](./.skilld/discussions/_INDEX.md) — Q&A, patterns, recipes • [Releases](./.skilld/releases/_INDEX.md) — changelog, breaking changes, new APIs

## Search

Use `npx -y skilld search` instead of grepping `.skilld/` directories — hybrid semantic + keyword search across all indexed docs, issues, and releases.

```bash
npx -y skilld search "query" -p vitest
npx -y skilld search "issues:error handling" -p vitest
npx -y skilld search "releases:deprecated" -p vitest
```

Filters: `docs:`, `issues:`, `releases:` prefix narrows by source type.

## API Changes

This section documents version-specific API changes -- prioritize recent major/minor releases.

- BREAKING: `test('name', fn, { retry: 2 })` -- v4 moved options to second argument: `test('name', { retry: 2 }, fn)`. Old third-argument options object silently ignored. Timeout number as last arg still works. [source](./.skilld/docs/guide/migration.md)

- BREAKING: `poolOptions` config -- v4 removed entirely. `poolOptions.forks.isolate` is now top-level `isolate`, `poolOptions.forks.execArgv` is now `execArgv`, `poolOptions.vmThreads.memoryLimit` is now `vmMemoryLimit`. Old nested config silently ignored. [source](./.skilld/docs/guide/migration.md)

- BREAKING: `workspace` config option -- v4 removed in favor of `projects`. `defineWorkspace()` and `vitest.workspace.js` no longer work. Use `test.projects` array in `vitest.config.ts` instead. [source](./.skilld/docs/guide/migration.md)

- BREAKING: `maxThreads`/`maxForks`/`singleThread`/`singleFork` -- v4 replaced with `maxWorkers` (and `maxWorkers: 1, isolate: false` for single mode). Env vars `VITEST_MAX_THREADS`/`VITEST_MAX_FORKS` replaced with `VITEST_MAX_WORKERS`. [source](./.skilld/docs/guide/migration.md)

- BREAKING: `coverage.all` and `coverage.extensions` -- v4 removed. Default now includes only covered files. Define `coverage.include` explicitly to include uncovered files. [source](./.skilld/docs/guide/migration.md)

- BREAKING: `coverage.ignoreEmptyLines` and `coverage.experimentalAstAwareRemapping` -- v4 removed. AST-aware remapping is now the default and only method. [source](./.skilld/docs/guide/migration.md)

- BREAKING: `vi.restoreAllMocks()` -- v4 no longer resets spy state; only restores `vi.spyOn` spies. Automocks unaffected. `.mockRestore()` on individual mocks still resets implementation and state. [source](./.skilld/docs/guide/migration.md)

- BREAKING: `vi.fn().getMockName()` -- v4 returns `'vi.fn()'` instead of `'spy'`. Snapshots containing `[MockFunction spy]` will change to `[MockFunction]`. [source](./.skilld/docs/guide/migration.md)

- BREAKING: `mock.invocationCallOrder` -- v4 starts at `1` (like Jest) instead of `0`. [source](./.skilld/docs/guide/migration.md)

- BREAKING: `vi.spyOn` on constructors -- v4 constructs instance with `new` instead of `mock.apply`. Arrow functions in `mockImplementation` now throw `is not a constructor`. Must use `function` or `class` keyword. [source](./.skilld/docs/guide/migration.md)

- BREAKING: `mock.settledResults` -- v4 populates immediately with `'incomplete'` result type on invocation, then updates when promise resolves/rejects. [source](./.skilld/docs/guide/migration.md)

- BREAKING: `browser.provider` config -- v4 requires factory function from `@vitest/browser-playwright`/`@vitest/browser-webdriverio`/`@vitest/browser-preview` instead of string `'playwright'`/`'webdriverio'`/`'preview'`. `@vitest/browser` package no longer needed. [source](./.skilld/docs/guide/migration.md)

- BREAKING: `@vitest/browser/context` import -- v4 moved to `vitest/browser`. Old import works during transition but will be removed. `@vitest/browser/utils` moved to `import { utils } from 'vitest/browser'`. [source](./.skilld/docs/guide/migration.md)

- BREAKING: Reporter APIs `onCollected`, `onSpecsCollected`, `onPathsCollected`, `onTaskUpdate`, `onFinished` -- v4 removed from reporter interface. Use new Reporter API introduced in v3. [source](./.skilld/docs/guide/migration.md)

**Also changed:** `'basic'` reporter removed (use `['default', { summary: false }]`) · `'verbose'` reporter now prints flat list (use `'tree'` for old tree behavior) · `test()/describe()` without function sets mode to `todo` · `environmentMatchGlobs`/`poolMatchGlobs` removed (use `projects`) · `deps.external`/`deps.inline`/`deps.fallbackCJS` removed (use `server.deps.*`) · `deps.optimizer.web` renamed to `deps.optimizer.client` · `minWorkers` removed · `VITE_NODE_DEPS_MODULE_DIRECTORIES` replaced with `VITEST_MODULE_DIRECTORIES` · `ErrorWithDiff` type removed (use `TestError`) · `UserConfig` type removed (use `ViteUserConfig`) · `getSourceMap` removed · Node types removed from main `vitest` entry (use `vitest/node`) · Vite 5 / Node 18 support dropped · `vitest/execute` entry removed · Snapshots with custom elements now print shadow root contents (disable with `snapshotFormat.printShadowRoot: false`) · Obsolete snapshots fail on CI · `expect.assert()` new for type-narrowing assertions · `expect.schemaMatching()` new asymmetric matcher for Standard Schema v1 validation · `toBeNullable()` new matcher for nullish checks · `vi.mockObject()` new with `{ spy: true }` option · `toMatchScreenshot()` new browser assertion for visual regression · `toBeInViewport()` new browser assertion · `page.frameLocator()` new browser API (playwright only) · `locator.length` property new · `recordArtifact()` new export from `@vitest/runner` · `test.beforeEach()`/`test.afterEach()` hooks now type-aware on extended tests

## Best Practices

- Use `test.dir` instead of broad `exclude` patterns to limit test discovery scope -- faster file scanning than excluding directories [source](./.skilld/docs/guide/improving-performance.md)

```ts
// Preferred
export default defineConfig({
  test: { dir: './src/tests' }
})

// Avoid -- slower, scans everything then filters
export default defineConfig({
  test: { exclude: ['**/dist/**', '**/docs/**', '**/scripts/**'] }
})
```

- Use `projects` to mix isolation/parallelism strategies per test type -- unit tests run non-isolated for speed, integration tests keep isolation [source](./.skilld/docs/guide/recipes.md)

```ts
export default defineConfig({
  test: {
    projects: [
      { name: 'unit', isolate: false, exclude: ['**.integration.test.ts'] },
      { name: 'integration', include: ['**.integration.test.ts'] },
    ],
  },
})
```

- Use `pool: 'threads'` over the default `'forks'` for faster test runs in larger projects -- forks is more compatible but threads has less overhead [source](./.skilld/docs/guide/improving-performance.md)

- Pass `{ spy: true }` to `vi.mock()` instead of manually wrapping every export with `vi.fn(original)` -- keeps original implementations while making all exports trackable, and shares call state between class instances and their prototype [source](./.skilld/docs/guide/mocking/modules.md)

```ts
vi.mock(import('./answer.js'), { spy: true })

// All exports keep original behavior but are spied on
expect(answer()).toBe(42)
expect(answer).toHaveBeenCalled()
// Class prototype tracks all instance calls
expect(Answer.prototype.value).toHaveBeenCalledTimes(2)
```

- Destructure test context when using `test.extend` fixtures -- Vitest only initializes fixtures that appear in the destructuring pattern, skipping unused ones entirely [source](./.skilld/docs/guide/test-context.md)

```ts
test('run', ({ todos }) => {}) // todos fixture initializes
test('skip', () => {})         // todos fixture skipped entirely
```

- Use `test.scoped()` to override fixture values per `describe` block instead of creating separate extended test objects -- inherited by nested suites automatically [source](./.skilld/docs/guide/test-context.md)

```ts
describe('postgres', () => {
  test.scoped({ schema: 'pg_schema' })
  test('queries work', ({ db }) => { /* db uses pg_schema */ })
})
```

- Use context `{ expect }` for concurrent tests with snapshots -- the global `expect` cannot track which concurrent test owns which snapshot [source](./.skilld/docs/guide/snapshot.md)

```ts
it.concurrent('math', ({ expect }) => {
  expect(2 + 2).toMatchInlineSnapshot()
})
```

- Always define `coverage.include` explicitly in v4 -- v4 removed `coverage.all` and defaults to only showing files loaded during tests, so uncovered source files are invisible without an include pattern [source](./.skilld/docs/guide/migration.md)

```ts
export default defineConfig({
  test: {
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
    },
  },
})
```

- Use `expect.schemaMatching()` with Standard Schema v1 libraries (Zod, Valibot, ArkType) for structural validation in assertions -- works as an asymmetric matcher in `toEqual`, `toMatchObject`, `toHaveBeenCalledWith`, etc. [source](./.skilld/docs/blog/vitest-4.md)

```ts
expect(user).toEqual({
  email: expect.schemaMatching(z.string().email()),
})
```

- In v4, pass test options as the second argument (before the callback), not the third -- the third-argument form was removed [source](./.skilld/docs/guide/migration.md)

```ts
test('retry', { retry: 2 }, () => { /* ... */ }) // correct
test('retry', () => { /* ... */ }, { retry: 2 }) // error in v4
```
