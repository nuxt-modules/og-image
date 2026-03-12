# Component Resolution Rework

Issue: #446 — v6 not working with Takumi, component naming conflicts, unwanted auto-eject

## Problem Summary

1. **Community templates always register satori** in `detectedRenderers`, bundling `@resvg/resvg-wasm` even for takumi-only users
2. **NuxtSeo.satori.vue auto-ejects** even when user wants takumi — no takumi community template exists
3. **Duplicate base names warned but not supported** — can't have `Banner.satori.vue` + `Banner.takumi.vue`
4. **Type keys include renderer suffix** — `defineOgImage('NuxtSeoSatori')` instead of `defineOgImage('NuxtSeo.satori')`
5. **Auto-eject triggers from devtools** previews, not just user page renders

## Design

### Component Naming

Primary key: **dot notation** — `'NuxtSeo.satori'`, `'Banner.takumi'`
Alias: **PascalCase** — `'NuxtSeoSatori'`, `'BannerTakumi'`
Shorthand: **bare name** — `'Banner'` ONLY when one renderer exists for that base name. Error if ambiguous.

### Type Generation (`src/templates.ts`)

For each component, generate:
- `'NuxtSeo.satori'` — primary key (dot notation)
- `'NuxtSeoSatori'` — alias (PascalCase, same type)
- `'NuxtSeo'` — shorthand (only if no other `NuxtSeo.*` variants exist)

### Runtime Resolution (`src/runtime/server/util/options.ts`)

New `normaliseOptions()` flow:
1. Parse component name → extract base name + renderer
   - `'Banner.satori'` → base=`Banner`, renderer=`satori`
   - `'BannerSatori'` → base=`Banner`, renderer=`satori`
   - `'Banner'` → base=`Banner`, renderer=`null`
2. Find components matching base name, filter by renderer if specified
3. If renderer=null: 1 match → use it, 0 → error, 2+ → error (ambiguous)

### Build-Time Detection (`src/module.ts`)

- `components:extend`: Remove duplicate warning. Group by base name in a `Map<string, OgImageComponent[]>`.
- Pre-scan: Only include community template renderers in `detectedRenderers` if user has NO components of their own. This prevents bundling unused renderer bindings.

### Community Templates

- Create `NuxtSeo.takumi.vue` alongside existing `NuxtSeo.satori.vue`
- Future: consider chromium variant too

### Auto-Eject

- **Keep auto-eject** but fix two issues:
  1. Only eject the specific renderer variant referenced (e.g., `defineOgImage('NuxtSeo.takumi')` ejects `.takumi.vue` only)
  2. Only trigger from user page SSR renders, not devtools preview requests
- Check: use request path or context flag to distinguish devtools from user pages

### Remove `defaults.renderer`

- `src/onboarding.ts:283` references `defaults.renderer` — clean up
- Renderer is always inferred from component suffix, never configured globally

## Implementation Steps

### Step 1: Add `parseComponentName()` helper to `src/util.ts`

Parse `'Banner.satori'` / `'BannerSatori'` / `'Banner'` into `{ baseName, renderer }`.

### Step 2: Update type generation in `src/templates.ts`

Generate dot-notation primary key + PascalCase alias + conditional bare-name shorthand.

### Step 3: Rework `normaliseOptions()` in `src/runtime/server/util/options.ts`

Use `parseComponentName()`, match against component list, handle ambiguity.

### Step 4: Update `components:extend` in `src/module.ts`

- Remove duplicate base name warning (now valid)
- Change `baseNameToRenderer` to `Map<string, OgImageComponent[]>`
- Fix pre-scan: only add community renderers when user has no components

### Step 5: Create `NuxtSeo.takumi.vue` community template

New file in `src/runtime/app/components/Templates/Community/`.

### Step 6: Fix auto-eject in `src/runtime/server/util/auto-eject.ts`

- Eject only the specific variant referenced
- Skip eject when request is from devtools (check path for `/__og-image__/`)

### Step 7: Clean up `src/onboarding.ts`

Remove `defaults.renderer` reference.

### Step 8: Update `OgImageOptions` type in `src/runtime/types.ts`

Remove `renderer` from public options type (keep internal if needed for PageScreenshot).

### Step 9: Update tests

Add tests for:
- Multiple renderers same base name
- Dot notation resolution
- PascalCase alias resolution
- Ambiguous shorthand error
- Auto-eject variant selection
- Renderer detection with/without user components

## Files

| File | Action |
|------|--------|
| `src/util.ts` | Add `parseComponentName()` |
| `src/templates.ts` | New type key generation |
| `src/runtime/server/util/options.ts` | Rework resolution |
| `src/module.ts` | Fix components:extend + pre-scan |
| `src/runtime/app/components/Templates/Community/NuxtSeo.takumi.vue` | New |
| `src/runtime/server/util/auto-eject.ts` | Fix variant + devtools guard |
| `src/runtime/server/og-image/context.ts` | Pass request context to auto-eject |
| `src/onboarding.ts` | Remove defaults.renderer |
| `src/runtime/types.ts` | Remove renderer from OgImageOptions |
