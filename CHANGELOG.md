# Changelog


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

