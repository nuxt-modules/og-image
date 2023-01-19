<h1 align='center'>nuxt-og-image</h1>

<p align="center">
<a href='https://github.com/harlan-zw/nuxt-og-image/actions/workflows/test.yml'>
</a>
<a href="https://www.npmjs.com/package/nuxt-og-image" target="__blank"><img src="https://img.shields.io/npm/v/nuxt-og-image?style=flat&colorA=002438&colorB=28CF8D" alt="NPM version"></a>
<a href="https://www.npmjs.com/package/nuxt-og-image" target="__blank"><img alt="NPM Downloads" src="https://img.shields.io/npm/dm/nuxt-og-image?flat&colorA=002438&colorB=28CF8D"></a>
<a href="https://github.com/harlan-zw/nuxt-og-image" target="__blank"><img alt="GitHub stars" src="https://img.shields.io/github/stars/harlan-zw/nuxt-og-image?flat&colorA=002438&colorB=28CF8D"></a>
</p>


<p align="center">
Enlightened OG Image generation for Nuxt 3.
</p>

<p align="center">
<table>
<tbody>
<td align="center">
<img width="800" height="0" /><br>
<i>Status:</i> v1 Released</b> <br>
<sup> Please report any issues 🐛</sup><br>
<sub>Made possible by my <a href="https://github.com/sponsors/harlan-zw">Sponsor Program 💖</a><br> Follow me <a href="https://twitter.com/harlan_zw">@harlan_zw</a> 🐦 • Join <a href="https://discord.gg/275MBUBvgP">Discord</a> for help</sub><br>
<img width="800" height="0" />
</td>
</tbody>
</table>
</p>

ℹ️ Looking for a complete SEO solution? Check out [nuxt-seo-kit](https://github.com/harlan-zw/nuxt-seo-kit).


## Features

## 🎨 Designer - Satori & Browser

- 🎨 Design your `og:image` in the Og Image Playground with full HMR
- Dynamically serve on the edge using Satori
- Prerender static images using Satori or the browser

## Screenshots - Browser

- 📸 OR just generate screenshots
- ⚙️ Screenshot options to hide elements, wait for animations, and more


## Install

```bash
# Install module
npm install --save-dev nuxt-og-image
# Using yarn
yarn add --dev nuxt-og-image
```

## Setup

_nuxt.config.ts_

```ts
export default defineNuxtConfig({
  modules: [
    'nuxt-og-image',
  ],
})
```

### Add your host name

The `og:image` meta tag requires the full URL, so you must provide your site host.

_nuxt.config.ts_

```ts
export default defineNuxtConfig({
  // Recommended 
  runtimeConfig: {
    siteUrl: 'https://example.com',
  },
  // OR
  ogImage: {
    host: 'https://example.com',
  },
})
```

### Prerender routes

While the module is in early access, only pre-rendered routes are supported.

```ts
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: [
        '/',
        // any URLs that can't be discovered by crawler
        '/my-hidden-url'
      ]
    }
  }
})
```  

## Generating Screenshots

_Your page / app.vue / layout_

```vue
<script lang="ts" setup>
// Choose either Composition API
defineOgImageScreenshot()
</script>
<template>
  <div>
    <!-- OR Component API -->
    <OgImageScreenshot />
  </div>
</template>
```


If you don't have a chromium binary installed on your system, run `npx playwright install`.

### CI Build

If you are using this module in a CI context and the images aren't being generated,
you should may need to install a chromium binary. You can do this by running `npx playwright install` or
`npm install playwright`.

_package.json_

```json
{
  "scripts": {
    "build": "npx playwright install && nuxt build"
  }
}
```


## Generating Template Images

The template image generator is powered by Nuxt Islands. This means that you can use any Vue
component you want to generate your images.

_Your page / app.vue / layout_

```vue
<script lang="ts" setup>
// Choose either Composition API
defineOgImage({
  component: 'OgImageTemplate', // Nuxt Island component
  alt: 'My awesome image', // alt text for image
  // pass in any custom props
  myCustomTitle: 'My Title'
})
</script>
<template>
  <div>
    <!-- OR Component API -->
    <OgImage component="OgImageTemplate" my-custom-title="My Title" />
  </div>
</template>
```

### Requirements

To be able to preview the image in development and generate template images, you'll need
to enable Nuxt Islands.

If you're using Nuxt 3.0.0, you will need to switch to the [edge-release channel](https://nuxt.com/docs/guide/going-further/edge-channel#edge-release-channel).

Once that's done, you can enable the flag for islands.

_nuxt.config.ts_

```ts
export default defineNuxtConfig({
  experimental: {
    componentIslands: true
  },
})
```

### Creating your own template

Create a new component with `.island.vue` as the suffix, such as `components/Banner.island.vue`.

Use the below template to test it works, then modify it how you like.

```vue
<script setup lang="ts">
const props = defineProps({
  // these will always be provided
  path: String,
  title: String,
  description: String,
  // anything custom comes here
  backgroundImage: String
})
</script>

<template>
  <div class="wrap">
    <div>
      <h1>
        {{ title }}
      </h1>
      <p>{{ description }}</p>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  background: linear-gradient(to bottom, #30e8bf, #ff8235);
}

h1 {
  font-size: 4rem;
}
</style>
```

Make sure you reference this component when using `defineOgImage` and any props to pass.

```vue
<script lang="ts" setup>
defineOgImage({
  component: 'Banner', 
  backgroundImage: 'https://example.com/my-background-image.jpg',
})
</script>
```

## Previewing Images

Once you have defined the og:image using the composable, you can preview the image by visiting
the following URLs:
- `/your-path/__og-image` Renders the HTML output
- `/your-path/og-image.png` Renders the og:image

## Module Config

### `host`

- Type: `string`
- Default: `undefined`
- Required: `true`

The host of your site. This is required to generate the absolute path of the og:image.

### `serverSideRender`

- Type: `boolean`
- Default: `process.dev`

It allows you to generate images at runtime in production.
This uses a headless browser to generate images
and may have deployment issues.

⚠️ This is experimental and will likely not work in all environments.

## Screenshot Options

These can be provided as module options to set defaults
or set individually on the `OgImageScreenshot` or `OgImage` components or the `defineOgImage` or `defineOgImageScreenshot` composables.

```ts
// optionally set defaults globally
export default defineNuxtConfig({
  ogImage: {
    colorScheme: 'dark',
    mask: '.screenshot-hidden'
  }
})
```

### `colorScheme`

- Type: `'dark' | 'light'`
- Default: `undefined`
- Required: `false`

The color scheme to use when generating the image. This is useful for generating dark mode images.

```ts
defineOgImageScreenshot({
  colorScheme: 'dark'
})
```

### `selector`

- Type: `string`
- Default: `undefined`
- Required: `false`

The selector to take a screenshot of. This is useful if you want to exclude header / footer elements.

```ts
defineOgImageScreenshot({
  mask: '.page-content'
})
```

### `mask`

- Type: `string`
- Default: `undefined`
- Required: `false`

HTML selectors that should be removed from the image. Useful for removing popup banners or other elements that may be in the way. 

```ts
defineOgImageScreenshot({
  mask: '.popup-banner, .cookie-banner'
})
```

### `delay`

- Type: `number`
- Default: `undefined`
- Required: `false`

The delay to wait before taking the screenshot. This is useful if you want to wait for animations to complete.

```ts
defineOgImageScreenshot({
  // wait 2 seconds
  delay: 2000
})
```

### `alt`

- Type: `string`
- Default: `Web page screenshot of {route}.`
- Required: `false`

Used to generate the `og:image:alt` meta.

### `width`

- Type: `number`
- Default: `1200`
- Required: `true`

The default width of the image. This is useful if you want to generate a specific size image.

```ts
defineOgImageScreenshot({
  width: 1500
})
```

### `height`

- Type: `number`
- Default: `630`
- Required: `true`

The default height of the image. This is useful if you want to generate a specific size image.

```ts
defineOgImageScreenshot({
  height: 700
})
```

## Examples

- [Unhead Docs](https://github.com/unjs/unhead/tree/main/docs)

## Sponsors

<p align="center">
  <a href="https://raw.githubusercontent.com/harlan-zw/static/main/sponsors.svg">
    <img src='https://raw.githubusercontent.com/harlan-zw/static/main/sponsors.svg'/>
  </a>
</p>

## Credits

- Pooya Parsa [Kachick](https://github.com/unjs/kachik)
- Nuxt Team

## License

MIT License © 2023-PRESENT [Harlan Wilton](https://github.com/harlan-zw)
