# Issue 2: Different Templates Render Same Output Despite Different URLs

## Problem

After renaming templates with namespaces, OG image URLs are different (different encoded segments) but the rendered images are identical — blog/slug pages use the index template instead of their own.

## Investigation Summary

The encoding/decoding pipeline looks correct for the main path:
- `defineOgImage('Blog', ...)` → component encoded as `c_Blog` in URL
- Server decodes `c_Blog` → `resolveComponent('Blog')` → finds correct component → renders

BUT there are **two bugs** that can cause the wrong template to render:

### Bug A: Devtools payload strips component matching defaults (prerender/hash mode)

**File**: `src/runtime/app/utils.ts:89-95`

```typescript
// Devtools payload construction — used for prerender cache
const final: Record<string, any> = {}
for (const k in payload) {
  if (payload[k] !== (defaults as any)[k]) {
    final[k] = payload[k]
  }
}
return final
```

This strips ANY field whose value matches `defaults[key]`. The `component` field at this point has been resolved via `resolveComponentName()` (line 80), so it might differ from what the user passed.

**But more critically**: this payload is what gets stored in the prerender cache (`prerender.ts:48`). If `component` is stripped, the server falls back to `componentNames[0]`.

**When this triggers**: If user sets `defaults.component` in their nuxt.config to match one of their templates, that template's name gets stripped from the prerender cache payload.

### Bug B: `encodeOgImageParams` skips component matching defaults in URL

**File**: `src/runtime/shared/urlEncoding.ts:173-175`

```typescript
// Skip values that match defaults
if (defaults && key in defaults && defaults[key] === value)
  continue
```

This skips encoding the component if it matches the configured default. The server then uses `runtimeConfig.defaults.component` as fallback. This is technically correct IF the server default matches — but it creates a fragile implicit dependency.

**Combined effect**: If the user has `defaults: { component: 'SiteIndex' }` in nuxt config:
- Pages using `defineOgImage('SiteIndex', ...)` → component omitted from URL (matches default)
- Pages using `defineOgImage('Blog', ...)` → component included as `c_Blog`
- Server handles SiteIndex URL: no component in URL → uses default → correct
- Server handles Blog URL: `c_Blog` → resolves → correct

This SHOULD work. But if the resolved component name on client differs from what the server expects (due to `resolveComponentName` vs `resolveComponent` asymmetry), it breaks.

### Bug C: Client/Server component name resolution asymmetry

**Client** (`utils.ts:107-122`): `resolveComponentName()` — finds first component where `basePascalName.endsWith(originalName)`, returns `component.pascalName`

**Server** (`options.ts:43-84`): `resolveComponent()` — more sophisticated matching with `parseInputName`, `getComponentBaseName`, renderer filtering

These two functions can resolve the SAME input to DIFFERENT component names because:
1. Client uses `endsWith` on PascalName (without stripping OgImage prefix for the registered name)
2. Server uses `endsWith` on the stripped base name
3. Client returns first match; server filters by renderer

If they disagree, the devtools payload (prerender cache) has a different component name than what the URL encodes, causing a mismatch during hash-mode lookup.

## Root Cause Files

| File | Lines | Issue |
|------|-------|-------|
| `src/runtime/app/utils.ts` | 89-95 | Strips component from prerender cache payload |
| `src/runtime/app/utils.ts` | 107-122 | Client-side resolution differs from server |
| `src/runtime/shared/urlEncoding.ts` | 173-175 | Skips encoding component matching defaults |
| `src/runtime/server/util/options.ts` | 43-84 | Server-side resolution logic |

## Fix Plan

### 1. Never strip `component` from devtools payload

In `utils.ts:89-95`, always preserve critical fields that affect rendering:

```typescript
const ALWAYS_INCLUDE_KEYS = new Set(['component', '_hash', 'key'])

const final: Record<string, any> = {}
for (const k in payload) {
  if (ALWAYS_INCLUDE_KEYS.has(k) || payload[k] !== (defaults as any)[k]) {
    final[k] = payload[k]
  }
}
return final
```

This ensures the prerender cache always has the correct component, regardless of defaults.

### 2. Unify component name resolution

Create a shared `resolveComponentName` function used by both client and server to ensure they always agree. The server's `resolveComponent` is more robust, so extract its name-matching logic into a shared utility.

Alternatively, the simpler fix: on the client, after `resolveComponentName` returns a name, the URL encoding should use THAT resolved name (not the raw input). Currently the URL uses the raw name while the devtools payload uses the resolved name — this is the asymmetry.

In `_defineOgImageRaw.ts`, resolve the component name BEFORE building the URL:

```typescript
// Before getOgImagePath, resolve the component name
if (validOptions.component) {
  validOptions.component = resolveComponentName(validOptions.component, defaults.component || '')
}
const { path, hash } = getOgImagePath(basePath, validOptions)
```

### 3. Always encode component in URL (don't skip even if matching default)

In `encodeOgImageParams`, never skip `component`:

```typescript
const NEVER_SKIP_KEYS = new Set(['component'])

// Skip values that match defaults
if (defaults && key in defaults && defaults[key] === value && !NEVER_SKIP_KEYS.has(key))
  continue
```

This makes URLs slightly longer but eliminates an entire class of bugs where the server's default doesn't match expectations.

## Testing

- Test with two custom templates where one matches `defaults.component`
- Test prerender cache stores correct component for both templates
- Test that URL always contains component name
- Test that client and server resolve the same input name to the same component
