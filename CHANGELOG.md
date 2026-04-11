# Changelog


## v6.3.6...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.3.6...main)

### 🩹 Fixes

- **prerender:** Compat issue with html validator ([51aa00d3](https://github.com/nuxt-modules/og-image/commit/51aa00d3))

### 🏡 Chore

- Wrong copy ([70eab6f5](https://github.com/nuxt-modules/og-image/commit/70eab6f5))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.3.5...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.3.5...main)

### 🩹 Fixes

- **prerender:** Edge cases in option caching ([93ab1c67](https://github.com/nuxt-modules/og-image/commit/93ab1c67))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.3.4...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.3.4...main)

### 🩹 Fixes

- **prerender:** Sign dynamic URLs in strict mode and handle orphan hashes ([#560](https://github.com/nuxt-modules/og-image/pull/560))

### 🏡 Chore

- Sync ([4529b9e7](https://github.com/nuxt-modules/og-image/commit/4529b9e7))
- Broken i18n fixture ([c96607be](https://github.com/nuxt-modules/og-image/commit/c96607be))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.3.3...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.3.3...main)

### 🩹 Fixes

- Add missing nitro presets to compatibility map ([#559](https://github.com/nuxt-modules/og-image/pull/559))

### 🏡 Chore

- Sync ([e2dcc301](https://github.com/nuxt-modules/og-image/commit/e2dcc301))
- Sync ([bd3b422f](https://github.com/nuxt-modules/og-image/commit/bd3b422f))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.3.2...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.3.2...main)

### 🩹 Fixes

- Expand variable font weights for all renderers ([#549](https://github.com/nuxt-modules/og-image/pull/549))
- Fall back across unicode-range font subsets for CJK rendering ([#554](https://github.com/nuxt-modules/og-image/pull/554))
- Auto-inject title and description from useSeoMeta into OG image props ([b4290b37](https://github.com/nuxt-modules/og-image/commit/b4290b37))
- Remove eager prerender path write to prevent stale URL race ([f17c7f94](https://github.com/nuxt-modules/og-image/commit/f17c7f94))
- Import injectHead from nuxt/app instead of @unhead/vue ([6d6d74d3](https://github.com/nuxt-modules/og-image/commit/6d6d74d3))
- Capture runtime config eagerly for lazy meta callback ([5e7a687a](https://github.com/nuxt-modules/og-image/commit/5e7a687a))
- Use Takumi `no-bundler` path so binary not included when `zeroRuntime: true` ([#556](https://github.com/nuxt-modules/og-image/pull/556))
- Auto-inject title and description from useSeoMeta into OG image props ([#555](https://github.com/nuxt-modules/og-image/pull/555))
- Move devtools-only deps to devDependencies ([0ea13015](https://github.com/nuxt-modules/og-image/commit/0ea13015))

### 🏡 Chore

- Bump ([0ebf894d](https://github.com/nuxt-modules/og-image/commit/0ebf894d))
- Bump ([7ae2246b](https://github.com/nuxt-modules/og-image/commit/7ae2246b))
- Sync ([f9935be6](https://github.com/nuxt-modules/og-image/commit/f9935be6))
- Sync ([05da4f64](https://github.com/nuxt-modules/og-image/commit/05da4f64))

### ✅ Tests

- Add e2e tests for useSeoMeta auto-injection into OG image props ([60eac224](https://github.com/nuxt-modules/og-image/commit/60eac224))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))
- Kane Wang ([@yeecord](https://github.com/yeecord))

## v6.3.0...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.3.0...main)

### 🩹 Fixes

- Prefer runtime config for secret ([651962d0](https://github.com/nuxt-modules/og-image/commit/651962d0))

### 🏡 Chore

- Bump ([8cf8dc3e](https://github.com/nuxt-modules/og-image/commit/8cf8dc3e))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.2.6...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.2.6...main)

### 🚀 Enhancements

- **security:** Add URL signing to prevent parameter tampering ([#546](https://github.com/nuxt-modules/og-image/pull/546))

### 🩹 Fixes

- **security:** Strict mode, deprecate `html` ([#545](https://github.com/nuxt-modules/og-image/pull/545))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.2.4...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.2.4...main)

### 🩹 Fixes

- Hydration-issue warning due to SSR generated DateTime value ([#535](https://github.com/nuxt-modules/og-image/pull/535))
- Sanitize component props ([#543](https://github.com/nuxt-modules/og-image/pull/543))
- Harden security defaults ([#540](https://github.com/nuxt-modules/og-image/pull/540))
- Whitelist component props to prevent cache key DoS ([#544](https://github.com/nuxt-modules/og-image/pull/544))

### 🏡 Chore

- Bump deps ([a8a65b66](https://github.com/nuxt-modules/og-image/commit/a8a65b66))
- Bump deps ([bcad7915](https://github.com/nuxt-modules/og-image/commit/bcad7915))
- Artifact ([284540a7](https://github.com/nuxt-modules/og-image/commit/284540a7))
- Sync ([e7deb1f7](https://github.com/nuxt-modules/og-image/commit/e7deb1f7))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))
- Loïs Bégué ([@khatastroffik](https://github.com/khatastroffik))

## v6.2.2...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.2.2...main)

### 🔥 Performance

- **devtools:** Drop json-editor-vue ([14a585b7](https://github.com/nuxt-modules/og-image/commit/14a585b7))

### 🩹 Fixes

- **cloudflare:** Detect legacy assets mode ([7f60a480](https://github.com/nuxt-modules/og-image/commit/7f60a480))

### 🏡 Chore

- Bump deps ([362cee2a](https://github.com/nuxt-modules/og-image/commit/362cee2a))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.2.1...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.2.1...main)

### 🏡 Chore

- Bump deps ([caf70605](https://github.com/nuxt-modules/og-image/commit/caf70605))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.2.0...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.2.0...main)

### 🩹 Fixes

- Missing compatibility config ([4541033c](https://github.com/nuxt-modules/og-image/commit/4541033c))
- **devtools:** Broken resolution ([57ac2647](https://github.com/nuxt-modules/og-image/commit/57ac2647))

### 🏡 Chore

- Label devtools layout ([ed041041](https://github.com/nuxt-modules/og-image/commit/ed041041))
- Bump deps ([41fa2371](https://github.com/nuxt-modules/og-image/commit/41fa2371))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.1.2...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.1.2...main)

### 🚀 Enhancements

- **content:** Add `defineOgImageSchema()` composable ([#520](https://github.com/nuxt-modules/og-image/pull/520))

### 🩹 Fixes

- Update pnpm-lock.yaml ([0784c378](https://github.com/nuxt-modules/og-image/commit/0784c378))
- Broken slash decoding in some cases ([6f8ac765](https://github.com/nuxt-modules/og-image/commit/6f8ac765))
- **client:** Resolve layer-devtools path via import.meta.resolve ([dd4e0578](https://github.com/nuxt-modules/og-image/commit/dd4e0578))
- **cloudflare:** Resolve fonts via localFetch when ASSETS binding unavailable ([#527](https://github.com/nuxt-modules/og-image/pull/527))
- B64 encode props with URL-sensitive characters ([#530](https://github.com/nuxt-modules/og-image/pull/530))
- Resolve CI issues ([f3e3045b](https://github.com/nuxt-modules/og-image/commit/f3e3045b))
- Use explicit imports mapping for #nuxtseo-shared ([08594505](https://github.com/nuxt-modules/og-image/commit/08594505))
- Use direct nuxtseo-shared/runtime imports, bump to ^0.3.0 ([31b1a991](https://github.com/nuxt-modules/og-image/commit/31b1a991))
- Resolve CI failures in lint, build, typecheck, and tests ([47e85d35](https://github.com/nuxt-modules/og-image/commit/47e85d35))
- Use dot-notation for ambiguous CalcTest component in type test ([3ba63fef](https://github.com/nuxt-modules/og-image/commit/3ba63fef))

### 💅 Refactors

- Migrate to nuxtseo-shared for shared utilities ([f909f014](https://github.com/nuxt-modules/og-image/commit/f909f014))
- **client:** Migrate devtools to nuxtseo-shared layer ([48c15483](https://github.com/nuxt-modules/og-image/commit/48c15483))
- Use published nuxtseo-layer-devtools package ([74393aa3](https://github.com/nuxt-modules/og-image/commit/74393aa3))
- Remove dead defensive prerender initialization ([3b0dae14](https://github.com/nuxt-modules/og-image/commit/3b0dae14))
- Use nuxtseo-shared subpath exports, bump to ^0.5.0 ([bd50740f](https://github.com/nuxt-modules/og-image/commit/bd50740f))
- Migrate to nuxtseo-shared ([#521](https://github.com/nuxt-modules/og-image/pull/521))

### 🏡 Chore

- Sync ([1f7cb2c4](https://github.com/nuxt-modules/og-image/commit/1f7cb2c4))
- Sync ([ca0fb5b0](https://github.com/nuxt-modules/og-image/commit/ca0fb5b0))
- Update lockfile ([162799b7](https://github.com/nuxt-modules/og-image/commit/162799b7))
- Bump nuxtseo-shared to ^0.2.0 ([ecf3d6b0](https://github.com/nuxt-modules/og-image/commit/ecf3d6b0))
- Bump nuxtseo-shared to ^0.4.0, revert runtime to #alias ([b368142f](https://github.com/nuxt-modules/og-image/commit/b368142f))
- Sync ([f173a2a7](https://github.com/nuxt-modules/og-image/commit/f173a2a7))
- Sync ([eb106f60](https://github.com/nuxt-modules/og-image/commit/eb106f60))
- Sync ([0f4b0f27](https://github.com/nuxt-modules/og-image/commit/0f4b0f27))
- Sync ([50f5e65e](https://github.com/nuxt-modules/og-image/commit/50f5e65e))
- Sync ([787a087e](https://github.com/nuxt-modules/og-image/commit/787a087e))
- Remove unrelated files from PR ([5f8ed2f2](https://github.com/nuxt-modules/og-image/commit/5f8ed2f2))
- Examples ([73c36536](https://github.com/nuxt-modules/og-image/commit/73c36536))
- Sync ([837a3e66](https://github.com/nuxt-modules/og-image/commit/837a3e66))
- Sync ([2d63ada7](https://github.com/nuxt-modules/og-image/commit/2d63ada7))

### ✅ Tests

- Update cloudflare-takumi snapshots after template redesign ([66c2a80a](https://github.com/nuxt-modules/og-image/commit/66c2a80a))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.1.1...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.1.1...main)

### 🩹 Fixes

- Auto-detect NuxtHub KV for cache storage ([#517](https://github.com/nuxt-modules/og-image/pull/517))
- **tw4:** Use safe module resolution to prevent throws for unresolvable plugins ([#519](https://github.com/nuxt-modules/og-image/pull/519))

### 🏡 Chore

- Sync ([7019fa01](https://github.com/nuxt-modules/og-image/commit/7019fa01))
- Sync ([46d07288](https://github.com/nuxt-modules/og-image/commit/46d07288))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.1.0...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.1.0...main)

### 🩹 Fixes

- Add missing option keys to URL encoding and prop separation ([#516](https://github.com/nuxt-modules/og-image/pull/516))
- Defer x-nitro-prerender header to prevent stale hash URLs during prerender ([#514](https://github.com/nuxt-modules/og-image/pull/514))
- Base64-encode non-ASCII values in URL path params ([#515](https://github.com/nuxt-modules/og-image/pull/515))

### 🏡 Chore

- Lint ([26863d01](https://github.com/nuxt-modules/og-image/commit/26863d01))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.0.7...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.0.7...main)

### 🚀 Enhancements

- **devtools:** Add production preview toggle ([#509](https://github.com/nuxt-modules/og-image/pull/509))
- **cli:** Add `create` and `switch` commands with DX improvements ([#508](https://github.com/nuxt-modules/og-image/pull/508))
- **devtools:** Add component creation from empty state ([#510](https://github.com/nuxt-modules/og-image/pull/510))

### 🩹 Fixes

- **encoding:** Avoid pre decoded params to be truncated ([#504](https://github.com/nuxt-modules/og-image/pull/504))
- **fonts:** Detect font families from script setup computed properties ([#507](https://github.com/nuxt-modules/og-image/pull/507))
- **devtools:** Use actual content width for preview scaling ([#506](https://github.com/nuxt-modules/og-image/pull/506))
- Recover from v5 defineOgImage syntax ([1e882060](https://github.com/nuxt-modules/og-image/commit/1e882060))

### 🏡 Chore

- Bump ([f9725ffd](https://github.com/nuxt-modules/og-image/commit/f9725ffd))
- Lint ([9bcb8358](https://github.com/nuxt-modules/og-image/commit/9bcb8358))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))
- Baptiste Leproux ([@larbish](https://github.com/larbish))

## v6.0.6...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.0.6...main)

### 🩹 Fixes

- Broken windows path resolutions ([dd1ae90b](https://github.com/nuxt-modules/og-image/commit/dd1ae90b))

### 🏡 Chore

- Bump ([923c9f83](https://github.com/nuxt-modules/og-image/commit/923c9f83))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.0.5...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.0.5...main)

### 🩹 Fixes

- Prevent crash when defineOgImage runs client-side during layout transitions ([#502](https://github.com/nuxt-modules/og-image/pull/502))
- **takumi:** Use real font family names for correct font-weight matching ([#503](https://github.com/nuxt-modules/og-image/pull/503))

### 🏡 Chore

- Bump deps ([06f54419](https://github.com/nuxt-modules/og-image/commit/06f54419))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.0.4...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.0.4...main)

### 🏡 Chore

- Broken mock still ([1f93bf7f](https://github.com/nuxt-modules/og-image/commit/1f93bf7f))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.0.3...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.0.3...main)

### 🩹 Fixes

- Don't mock null bindings ([c46560be](https://github.com/nuxt-modules/og-image/commit/c46560be))

### 🏡 Chore

- Bump ([47f57f51](https://github.com/nuxt-modules/og-image/commit/47f57f51))

### ❤️ Contributors

- Harlan Wilton <harlan@harlanzw.com>

## v6.0.2...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.0.2...main)

### 🩹 Fixes

- Normalize font casing ([61f8fb36](https://github.com/nuxt-modules/og-image/commit/61f8fb36))
- Svg dimensions not properly resolving in runtime instances ([4a5c8324](https://github.com/nuxt-modules/og-image/commit/4a5c8324))
- Resolve lint errors for CI ([aac48d30](https://github.com/nuxt-modules/og-image/commit/aac48d30))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.0.1...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.0.1...main)

### 🩹 Fixes

- **takumi:** Broken font weight matching ([3f0c5eaa](https://github.com/nuxt-modules/og-image/commit/3f0c5eaa))
- **migration:** Broken warning ([d87d88a1](https://github.com/nuxt-modules/og-image/commit/d87d88a1))
- **takumi:** Html -> nodes attr ordering ([35ea6145](https://github.com/nuxt-modules/og-image/commit/35ea6145))
- **satori:** Better css var matching ([251f1ee4](https://github.com/nuxt-modules/og-image/commit/251f1ee4))
- **satori:** Infer SVG dimensions from parent ([94ef0abc](https://github.com/nuxt-modules/og-image/commit/94ef0abc))

### 💅 Refactors

- Drop `sanitizeTakumiStyles` ([#498](https://github.com/nuxt-modules/og-image/pull/498))
- Runtime font loading unify ([4c87a57c](https://github.com/nuxt-modules/og-image/commit/4c87a57c))

### 🏡 Chore

- Re-do test infastructure ([704a6d4d](https://github.com/nuxt-modules/og-image/commit/704a6d4d))
- Sync ([9d98db9c](https://github.com/nuxt-modules/og-image/commit/9d98db9c))
- Test ([1d4f49ce](https://github.com/nuxt-modules/og-image/commit/1d4f49ce))
- Sync ([5762d157](https://github.com/nuxt-modules/og-image/commit/5762d157))
- Sync ([8ba3de55](https://github.com/nuxt-modules/og-image/commit/8ba3de55))
- Sync ([fb35f0f9](https://github.com/nuxt-modules/og-image/commit/fb35f0f9))
- CI ([127df981](https://github.com/nuxt-modules/og-image/commit/127df981))
- CI ([04b106b6](https://github.com/nuxt-modules/og-image/commit/04b106b6))

### ❤️ Contributors

- Harlan Wilton <harlan@harlanzw.com>
- Kane Wang <kane@yeecord.com>

## v6.0.0...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.0.0...main)

### 🚀 Enhancements

- Add `defineOgImageUrl` composable for pre-prepared images ([acff3941](https://github.com/nuxt-modules/og-image/commit/acff3941))

### 🩹 Fixes

- Support node cluster ([e5c2571c](https://github.com/nuxt-modules/og-image/commit/e5c2571c))
- Add defineOgImageUrl to tree-shake plugin, fix mock type and doc anchor ([c1a85a56](https://github.com/nuxt-modules/og-image/commit/c1a85a56))
- Lint error in defineOgImageUrl docs ([da9dc452](https://github.com/nuxt-modules/og-image/commit/da9dc452))
- Use element loc instead of child loc in ultrahtml SFC parser ([d5cd4f95](https://github.com/nuxt-modules/og-image/commit/d5cd4f95))
- **migration:** `defineOgImage({ url })` -> `useSeoMeta` ([#496](https://github.com/nuxt-modules/og-image/pull/496))

### 💅 Refactors

- Drop defineOgImageUrl, use useSeoMeta for pre-prepared images ([ccbaa48f](https://github.com/nuxt-modules/og-image/commit/ccbaa48f))
- Replace HTML template regex with ultrahtml AST in CLI migration ([32a49eeb](https://github.com/nuxt-modules/og-image/commit/32a49eeb))
- Use ultrahtml for SFC block extraction, remove last regex parsers ([15b7b998](https://github.com/nuxt-modules/og-image/commit/15b7b998))

### 🏡 Chore

- Remove beta flag ([c6d8e981](https://github.com/nuxt-modules/og-image/commit/c6d8e981))
- Bump deps ([350bc579](https://github.com/nuxt-modules/og-image/commit/350bc579))
- Bump deps ([499500e3](https://github.com/nuxt-modules/og-image/commit/499500e3))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

## v6.0.0-beta.48...main

[compare changes](https://github.com/nuxt-modules/og-image/compare/v6.0.0-beta.48...main)

### 🩹 Fixes

- Support .webp with takumi ([5f5700a3](https://github.com/nuxt-modules/og-image/commit/5f5700a3))
- Cli v6 migration gaps ([70a4987c](https://github.com/nuxt-modules/og-image/commit/70a4987c))
- **takumi:** Warn on missing css vars ([a0a2fec2](https://github.com/nuxt-modules/og-image/commit/a0a2fec2))
- Skip community templates from renderer selection ([f9d18ea6](https://github.com/nuxt-modules/og-image/commit/f9d18ea6))

### 🏡 Chore

- Bump deps ([6b896dd9](https://github.com/nuxt-modules/og-image/commit/6b896dd9))
- Tutorial test ([5d9e5e06](https://github.com/nuxt-modules/og-image/commit/5d9e5e06))
- Sync ([a5e465df](https://github.com/nuxt-modules/og-image/commit/a5e465df))

### ❤️ Contributors

- Harlan Wilton ([@harlan-zw](https://github.com/harlan-zw))

