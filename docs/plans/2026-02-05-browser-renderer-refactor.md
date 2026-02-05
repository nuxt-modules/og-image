# Browser Renderer Refactor

Rename `chromium` renderer to `browser` and add Cloudflare Browser Rendering support.

## Overview

- Rename `chromium` → `browser` throughout codebase
- Add `cloudflare` provider using `@cloudflare/puppeteer`
- New config shape: `browser: { provider, binding? }`
- Component suffix: `.chromium.vue` → `.browser.vue`
- Clean break, no backwards compatibility

## Configuration Schema

```ts
// nuxt.config.ts
ogImage: {
  // Local providers
  browser: {
    provider: 'playwright' | 'chrome-launcher' | 'on-demand'
  }

  // Cloudflare
  browser: {
    provider: 'cloudflare',
    binding: 'BROWSER'  // wrangler binding name, required
  }

  // Disable
  browser: false
}
```

**Type definition:**

```ts
type BrowserConfig = false | {
  provider: 'playwright' | 'chrome-launcher' | 'on-demand' | 'cloudflare'
  binding?: string // required when provider === 'cloudflare'
}
```

**Runtime behavior:**
- `provider: 'cloudflare'` → use `chrome-launcher` for dev (zero config), `playwright` for prerender, `cloudflare` for production
- Other providers → use same provider for all contexts

## File Structure

**Directory renames:**
```
src/runtime/server/og-image/chromium/           → browser/
src/runtime/server/og-image/bindings/chromium/  → bindings/browser/
```

**Binding files:**
```
bindings/browser/
├── playwright.ts        # unchanged logic
├── chrome-launcher.ts   # unchanged logic
├── on-demand.ts         # unchanged logic
└── cloudflare.ts        # NEW
```

**Renderer:**
```ts
// browser/renderer.ts
const BrowserRenderer: Renderer = {
  name: 'browser',
  supportedFormats: ['png', 'jpeg', 'jpg'],
  // ...
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/runtime/types.ts` | `RendererType` enum, new `BrowserConfig` type |
| `src/module.ts` | Config parsing, cloudflare provider detection, binding selection logic |
| `src/compatibility.ts` | Preset compatibility for cloudflare, alias paths `#og-image/bindings/browser` |
| `src/runtime/server/og-image/instances.ts` | `useChromiumRenderer` → `useBrowserRenderer` |
| `src/runtime/server/og-image/context.ts` | Switch case `'chromium'` → `'browser'` |
| `src/templates.ts` | Virtual module declarations |
| `src/utils/dependencies.ts` | Add `@cloudflare/puppeteer` dependency info |
| `docs/content/2.renderers/3.chromium.md` | Rename to `3.browser.md`, update content |
| `src/util.ts` | `VALID_RENDERER_SUFFIXES`, `getRendererFromFilename()`, `stripRendererSuffix()`, `parseComponentName()` |
| `src/cli.ts` | `RENDERERS` array, `getRendererDeps()` switch, `getBaseName()` regex, `hasRendererSuffix()` regex |
| `src/onboarding.ts` | `RENDERERS` array, `getRendererDeps()` function |
| `src/migrations/warnings.ts` | Deprecated config warnings referencing chromium |
| `src/runtime/server/util/auto-eject.ts` | Regex pattern `/(Satori\|Chromium\|Takumi)$/` |
| `src/runtime/server/util/options.ts` | `RENDERER_SUFFIXES`, `parseInputName()`, `getComponentBaseName()` |
| `src/build/generate.ts` | Config compatibility object `'chromium': false` |
| Test files | `test/unit/component-resolution.test.ts`, `test/unit/cli.test.ts`, `test/e2e/*.test.ts` |

**Component resolution:**
- Files checking for `.chromium.vue` suffix → `.browser.vue`

## Cloudflare Binding Implementation

**`bindings/browser/cloudflare.ts`:**

```ts
import type { Browser } from '@cloudflare/puppeteer'
import puppeteer from '@cloudflare/puppeteer'

let browser: Browser | null = null
let browserPromise: Promise<Browser> | null = null

export async function createBrowser(event: H3Event): Promise<Browser> {
  // Prevent race conditions with concurrent requests
  if (browser?.connected)
    return browser
  if (browserPromise)
    return browserPromise

  const bindingName = useRuntimeConfig().ogImage.browser.binding
  const binding = event.context.cloudflare?.env?.[bindingName]

  if (!binding) {
    throw new Error(
      `Cloudflare browser binding "${bindingName}" not found. `
      + `Ensure it's configured in wrangler.toml`
    )
  }

  browserPromise = (async () => {
    // Reuse existing sessions when possible (Cloudflare best practice)
    const sessions = await puppeteer.sessions(binding)
    const existingSession = sessions.find(s => !s.connected)

    if (existingSession) {
      browser = await puppeteer.connect(binding, existingSession.id)
    }
    else {
      browser = await puppeteer.launch(binding)
    }

    // Reset on disconnect (handles 60s idle timeout)
    browser.on('disconnected', () => {
      browser = null
    })

    return browser
  })()

  browser = await browserPromise
  browserPromise = null
  return browser
}

export async function disposeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => {})
    browser = null
  }
}
```

**Critical notes:**
- Env accessed via `event.context.cloudflare.env` (h3/Nitro standard)
- User must manually install `@cloudflare/puppeteer` (error thrown if missing)
- Session reuse reduces cold starts and respects rate limits
- `browser.on('disconnected')` handles 60s idle timeout
- Wrangler requires `nodejs_compat = true` and `compatibility_date >= "2025-09-15"`
- Rate limits: 3 browsers/min (free), 30/min (paid)

**Binding name passed via runtime config:** `runtimeConfig.ogImage.browser.binding`

## Screenshot Compatibility

Unified `screenshot.ts` with conditionals for API differences:

| Playwright | Puppeteer (Cloudflare) | Notes |
|------------|------------------------|-------|
| `page.goto(url, { waitUntil: 'networkidle' })` | `page.goto(url, { waitUntil: 'networkidle0' })` | Value difference |
| `page.setViewportSize()` | `page.setViewport()` | Method name |
| `page.waitForLoadState('networkidle')` | `page.waitForNavigation({ waitUntil: 'networkidle0' })` | **Different API** |
| `page.locator(selector).screenshot()` | `(await page.$(selector)).screenshot()` | **No locator API** |
| `PageScreenshotOptions.animations: 'disabled'` | May not be supported | **Verify support** |

**Detection pattern:**
```ts
const isPlaywright = typeof page.setViewportSize === 'function'
```

## Validation & Errors

**Build-time (module.ts):**

```ts
if (config.browser?.provider === 'cloudflare') {
  if (!config.browser.binding) {
    throw new Error('`ogImage.browser.binding` is required when provider is cloudflare')
  }

  if (!hasDependency('@cloudflare/puppeteer')) {
    throw new Error(
      'Missing @cloudflare/puppeteer dependency. '
      + 'Install it with: pnpm add @cloudflare/puppeteer'
    )
  }
}
```

**Preset compatibility (compatibility.ts):**

```ts
'cloudflare-pages': {
  browser: false,  // default off, user must explicitly enable
}
'cloudflare-workers': {
  browser: false,
}
```

## Breaking Changes

1. `chromium` renderer renamed to `browser`
2. `.chromium.vue` component suffix → `.browser.vue`
3. Config `chromium: 'playwright'` → `browser: { provider: 'playwright' }`
4. Internal: `useChromiumRenderer()` → `useBrowserRenderer()`

No deprecation warnings — clean break.

## Implementation Order

1. [ ] Add types (`BrowserConfig`, update `RendererType`)
2. [ ] Rename directories (`chromium/` → `browser/`)
3. [ ] Update renderer (`browser/renderer.ts`)
4. [ ] Update bindings path and aliases
5. [ ] Create `cloudflare.ts` binding
6. [ ] Update `screenshot.ts` with Puppeteer conditionals
7. [ ] Update `module.ts` config parsing and validation
8. [ ] Update `compatibility.ts` presets
9. [ ] Update `instances.ts` and `context.ts`
10. [ ] Update component suffix detection (`.browser.vue`)
11. [ ] Update `templates.ts` virtual modules
12. [ ] Update `dependencies.ts`
13. [ ] Update util files (`src/util.ts`, `src/cli.ts`, `src/onboarding.ts`, `src/migrations/warnings.ts`)
14. [ ] Update server utils (`auto-eject.ts`, `options.ts`, `generate.ts`)
15. [ ] Rename and update docs
16. [ ] Update tests

---

## Design Decisions

### Q1: How does dev/prerender fallback work?

**Decision:** Build-time binding selection per context:
- **Dev:** `chrome-launcher` (zero config, works out of the box)
- **Prerender:** `playwright` (headless, reliable for SSG)
- **Production (cloudflare):** `cloudflare` binding

Implementation in `module.ts`:
```ts
if (config.browser?.provider === 'cloudflare') {
  browserBinding.dev = 'chrome-launcher'
  browserBinding.prerender = 'playwright'
  browserBinding.runtime = 'cloudflare'
}
```

### Q2: Who owns browser lifecycle?

**Decision:** Binding manages lifecycle. Renderer does NOT close browser.

For cloudflare: session reuse + disconnect handler handles 60s idle timeout.

### Q3: Runtime config for browser.binding

**Required in module.ts:**
```ts
runtimeConfig.ogImage = {
  ...runtimeConfig.ogImage,
  browser: {
    provider: config.browser?.provider,
    binding: config.browser?.binding,
  }
}
```

### Q4: How does cloudflare binding receive env?

**Decision:** Use h3 event context: `event.context.cloudflare.env`

Signature: `createBrowser(event: H3Event)`

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Race condition in browser caching | HIGH | Promise-based locking in binding ✓ |
| HMR breaks browser connections | MEDIUM | `disposeBrowser()` export for dev mode cleanup |
| Cloudflare rate limiting | MEDIUM | Document limits in docs |
| Missing @cloudflare/puppeteer | HIGH | Throw build error if missing ✓ |
| Screenshot API differences missed | HIGH | Test both Playwright and Puppeteer paths |
| Session timeout (60s idle) | MEDIUM | Disconnect handler resets instance ✓ |
| nodejs_compat not enabled | MEDIUM | Document in setup guide |
