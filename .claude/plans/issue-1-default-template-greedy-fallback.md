# Issue 1: "Default" Template Name Causes Greedy Fallback

## Problem

A template named `Default.satori.vue` gets applied to pages it shouldn't because:

1. **`endsWith` matching is too broad** in `resolveComponent()` (`src/runtime/server/util/options.ts:55-59`)
2. **`componentNames[0]` fallback** applies the first registered component to any page without explicit component specification

### Specific `endsWith` Bug

```typescript
// options.ts:55-59
const matches = componentNames.filter((c: OgImageComponent) => {
  const cBase = getComponentBaseName(c)
  return cBase === baseName || cBase === strippedBaseName
    || cBase.endsWith(baseName) || cBase.endsWith(strippedBaseName) // <-- TOO BROAD
    || baseName.endsWith(cBase) || strippedBaseName.endsWith(cBase) // <-- TOO BROAD
})
```

If user has `Default.satori.vue` (base: `Default`), then ANY component ending with "Default" matches:
- `OgImageDefault` → `endsWith('Default')` = TRUE (correct)
- `OgImageBlogDefault` → `endsWith('Default')` = TRUE (WRONG - false positive)

Similarly, `baseName.endsWith(cBase)` can match wrong components when input is longer than registered name.

### Same issue exists on client in `resolveComponentName()` (`src/runtime/app/utils.ts:107-122`)

```typescript
if (basePascalName.endsWith(originalName) || baseKebabName.endsWith(originalName)) {
  return component.pascalName // returns FIRST match, which may be wrong
}
```

## Root Cause Files

| File | Lines | Issue |
|------|-------|-------|
| `src/runtime/server/util/options.ts` | 55-59 | `endsWith` matching false positives |
| `src/runtime/server/util/options.ts` | 117-118 | `componentNames[0]` blind fallback |
| `src/runtime/app/utils.ts` | 112-118 | Same `endsWith` issue on client side |

## Fix Plan

### 1. Tighten component name matching in `resolveComponent()` (server)

Replace `endsWith` with boundary-aware matching. A match should only occur when the input name aligns with a word boundary in the registered component name:

```typescript
// Instead of cBase.endsWith(baseName), require the match is either:
// a) exact match (cBase === baseName)
// b) cBase equals "OgImage" + baseName (the standard prefix)
const matches = componentNames.filter((c: OgImageComponent) => {
  const cBase = getComponentBaseName(c)
  return cBase === baseName
    || cBase === strippedBaseName
    || cBase === `OgImage${baseName}`
    || cBase === `OgImage${strippedBaseName}`
})
```

### 2. Apply same fix to `resolveComponentName()` (client)

```typescript
// utils.ts:112-118 — same tightening
if (basePascalName === originalName || basePascalName === `OgImage${originalName}`) {
  return component.pascalName
}
```

### 3. Add warning when fallback to `componentNames[0]` is used

In `normaliseOptions()` (options.ts:116-120), log a dev warning when falling back to help users debug:

```typescript
else {
  if (import.meta.dev)
    console.warn(`[Nuxt OG Image] No component specified, using fallback: ${componentNames[0].pascalName}`)
  resolved = componentNames[0]
  renderer = resolved.renderer
}
```

## Testing

- Add unit tests for `resolveComponent` with edge cases:
  - `'Default'` should NOT match `'BlogDefault'`
  - `'Default'` SHOULD match `'OgImageDefault'`
  - `'Banner'` should NOT match `'OgImageSiteBanner'` (unless exact prefix match)
  - `'NuxtSeo'` SHOULD match `'NuxtSeoSatori'`
