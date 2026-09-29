---
name: nuxt-og-image
description: Generate, fix, or debug Open Graph images in a Nuxt app with the nuxt-og-image module. Use when a task mentions og:image, social share images, twitter:image, defineOgImage, defineOgImageScreenshot, components/OgImage templates, the Takumi, Satori, or browser renderer, the ogImage config key, zeroRuntime, or /_og/ URLs. Also use when an OG image renders the wrong template, returns 403 or 500, shows no text on Cloudflare, or has a relative URL.
---

# nuxt-og-image

Tested against `nuxt-og-image` 6.9.1 on Nuxt 4.5 with `@takumi-rs/core` 2 (requires Nuxt `>=3.16.0`).
The module renders a Vue component to a PNG and adds `og:image` and `twitter:image` meta for the page. Docs: https://nuxtseo.com/docs/og-image

## Setup

- Set `site.url`. Without it, prerendered pages get a relative `og:image` such as `/_og/s/o_x.png`. The build warns, but still succeeds. Crawlers need an absolute URL.
- Install one renderer yourself: `@takumi-rs/core` (recommended), or `satori` with `@resvg/resvg-js`. Use the Wasm packages (`@takumi-rs/wasm`, `@resvg/resvg-wasm`) on edge runtimes. `pnpm exec nuxt-og-image enable takumi` installs the right one.
- If a template needs a renderer that is not installed, the production build fails with the install command. In dev, the module asks before it installs in an interactive terminal. In an agent, CI, or piped shell it only logs the command and never edits `package.json`.
- With no template and no renderer installed, OG images are off, and the module logs `npx nuxt-og-image enable takumi`.
- The module needs SSR. With `ssr: false` it warns and does nothing.

## Automatic behaviour

- Only pages that call `defineOgImage()` get OG image meta. A page with its own `useSeoMeta({ ogImage })` keeps it.
- `defineOgImage`, `defineOgImageScreenshot`, and `getOgImagePath` are auto-imported. `getOgImageUrl` is auto-imported in server code.
- Any `.vue` file in `components/OgImage/` is a template. The filename suffix picks the renderer: `Card.takumi.vue`, `Card.satori.vue`, `Card.browser.vue`. A file without a suffix is invalid. There is no renderer option.
- Default size is 1200 by 600, not 1200 by 630. Set `ogImage.defaults.height` to change it.
- Runtime URLs are signed. With no `security.secret`, the module generates one per build and warns in dev. A tampered URL, or a URL without a signature, returns 403 in production. Query overrides such as `?title=X` are ignored. Dev and prerender skip the check.
- A prerendered page gets a static file at `/_og/s/`. A server rendered page gets `/_og/d/` with all props encoded in the path.
- Inter 400 and 700 are bundled. Emoji use the `noto` set and follow the size of the surrounding text.

## Common tasks

Create a template, then call it from a page:

```vue
<!-- components/OgImage/Card.takumi.vue (app/components/ on Nuxt 4) -->
<script setup lang="ts">
const { title = 'My site', color = '#86efac' } = defineProps<{ title?: string, color?: string }>()
</script>

<template>
  <div class="w-full h-full flex items-center justify-center bg-blue-500 border-solid border-[24px]" :style="{ borderColor: color }">
    <h1 class="text-8xl font-bold text-white">
      {{ title }}
    </h1>
  </div>
</template>
```

```vue
<!-- pages/index.vue -->
<script setup lang="ts">
defineOgImage('Card', { title: 'Hello' })
</script>
```

The second argument holds the component props. Image options such as `width`, `alt`, or `cacheMaxAgeSeconds` go in the third argument.
Tailwind classes work without the Tailwind module. Put values that come from props in `:style`. The module resolves theme classes at build time, so a class built from a prop, such as `` `bg-${tone}` ``, gets only the renderer's default palette: `bg-red-500` renders, `bg-primary-500` or `bg-brand` renders nothing.
Give every prop a default, so DevTools can preview the template.
If two variants share a name, `'Card'` picks the first one. Use `'Card.takumi'` to select one.

More than one image per page, for example a square one for WhatsApp:

```ts
defineOgImage('Card', { title: 'Hello' }, [
  { key: 'og' },
  { key: 'whatsapp', width: 800, height: 800 },
])
```

`key: 'og'` writes `og:image` and `twitter:image`. Any other key writes only `og:image`. `key: 'twitter'` writes only `twitter:image`.

Set options for a group of pages with route rules. `ogImage: false` removes the image, even when the page calls `defineOgImage()`:

```ts
export default defineNuxtConfig({
  routeRules: {
    '/blog/**': { ogImage: { props: { title: 'Blog' } } },
    '/private/**': { ogImage: false },
  },
})
```

Keep runtime URLs short: pass a slug, then `await $fetch()` the data inside the template.
To use an existing image, call `useSeoMeta({ ogImage: '/cover.png' })`. The v5 `defineOgImage({ url })` form is gone.

## Traps

- **Community templates such as `NuxtSeo` work only in dev.** A dev page render copies the template into `components/OgImage/`. A production build fails on `defineOgImage('NuxtSeo')` until you eject it. A component name built at runtime is not checked at build; that image returns 500. Run `pnpm exec nuxt-og-image eject NuxtSeo`. It picks the variant for the renderer your app uses; `eject NuxtSeo.takumi` or `eject NuxtSeo.satori` chooses one.
- **`zeroRuntime: true` removes the `/_og/d/` handler.** A page that is not prerendered gets no `og:image`. Prerender every page that calls `defineOgImage()`.
- **`defineOgImageScreenshot()` needs `ogImage.browser`.** Without it, the production build fails. Set `browser: true` for local Chrome or Playwright, or `{ provider: 'cloudflare', binding: 'BROWSER' }`. Use it for prerendered pages; most hosts cannot run a browser.
- **`defineOgImage()` in a client only component throws in dev and renders nothing in production.** Call it in page or layout setup, on the server.
- **A border class needs `border-solid`.** A width without a style draws nothing, as in CSS.
- **Rolling or multi instance deploys need a stable secret.** Set `NUXT_OG_IMAGE_SECRET` from `pnpm exec nuxt-og-image generate-secret`. Otherwise a URL signed by one build fails on another with 403.
- **A wildcard route rule with `swr`, `isr`, or `cache` breaks `/_og/` routes.** The module warns. Use narrower patterns such as `/blog/**`.

## Fonts

Custom fonts load only through `@nuxt/fonts`, and each family needs `global: true`. CSS `@font-face` rules and font CDN links do not reach the renderer. Local fonts: Takumi reads woff2 and ttf; Satori reads woff, ttf, and otf.

```ts
export default defineNuxtConfig({
  modules: ['@nuxt/fonts', 'nuxt-og-image'],
  fonts: { families: [{ name: 'Roboto', weights: [400, 700], global: true }] },
})
```

## Cloudflare

Takumi and Satori use Wasm on Workers. If images render with no text, the Worker has no `ASSETS` binding and cannot load fonts. Set `nitro.cloudflare.deployConfig: true` and deploy with `wrangler --cwd .output deploy`, or add an `[assets]` block to your own Wrangler config. The runtime cache is in memory; for KV set `ogImage.runtimeCacheStorage: { driver: 'cloudflare-kv-binding', binding: 'OG_IMAGE_CACHE' }`.
Guide: https://nuxtseo.com/docs/og-image/guides/cloudflare

## Version limits

v6 changes that older examples still show:

- `defineOgImageComponent('X', props)` is deprecated. Use `defineOgImage('X', props)`.
- `<OgImage>` and `<OgImageScreenshot>` components, `ogImage.fonts`, `componentOptions`, and `defaults.renderer` are removed.
- `/__og-image__/image/` is now `/_og/d/`, and `/__og-image__/static/` is now `/_og/s/`.
- `pnpm exec nuxt-og-image migrate v6 --dry-run` previews the renames.

The `html` option is deprecated, and `security.strict` removes it. Use a component.

## Config

- `defaults`: default image options, such as `width`, `height`, `extension`, `emojis`. Options equal to a default stay out of the URL.
- `zeroRuntime` (`false`): drop the runtime renderer. See the trap above.
- `security.secret`, `security.strict` (`false`): `strict` requires an explicit secret, drops `html`, and restricts runtime images to the site host.
- `browser`: enables screenshots and `.browser.vue` templates.
- Other options: https://nuxtseo.com/docs/og-image/api/config

## Debug

- Nuxt DevTools has an OG Image tab with a live preview.
- In dev, the image at a URL is cached. After a template edit, append `?purge` to the image URL.
- `ogImage.debug: true` adds `/_og/debug.json` and logs more. It warns if left on in production.
