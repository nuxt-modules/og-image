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

<img src="https://repository-images.githubusercontent.com/578125755/05ce0b00-ef15-48d0-94b5-b999373a20f9">

<p align="center">
<table>
<tbody>
<td align="center">
<img width="800" height="0" /><br>
<i>Status:</i> <a href="https://github.com/harlan-zw/nuxt-og-image/releases/tag/v1.0.0">v1 Released</a></b> <br>
<sup> Please report any issues 🐛</sup><br>
<sub>Made possible by my <a href="https://github.com/sponsors/harlan-zw">Sponsor Program 💖</a><br> Follow me <a href="https://twitter.com/harlan_zw">@harlan_zw</a> 🐦 • Join <a href="https://discord.gg/275MBUBvgP">Discord</a> for help</sub><br>
<img width="800" height="0" />
</td>
</tbody>
</table>
</p>

ℹ️ Looking for a complete SEO solution? Check out [Nuxt SEO Kit](https://github.com/harlan-zw/nuxt-seo-kit).

## Features

- ✨ Turn your Vue components into `og:image` templates
- 🎨 Design them in the OG Image Playground with full HMR
- ▲ Render using [Satori](https://github.com/vercel/satori): Tailwind classes, Google fonts, emoji support and more!
- 🤖 Or prerender using the Browser: Supporting painless, complex templates
- 📸 Feeling lazy? Just generate screenshots for every page: hide elements, wait for animations, and more
- ⚙️ Works on the edge: Vercel Edge and Cloudflare Workers

## Demos

- [Vercel Edge Demo](https://nuxt-og-image-playground.vercel.app/)
- [StackBlitz - Minimal Playground Example](https://stackblitz.com/edit/nuxt-starter-pxs3wk?file=pages/index.vue)
- [StackBlitz - Alpine Theme](https://stackblitz.com/edit/github-hgunsf?file=package.json)

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

#### Requirements

This feature uses Nuxt Islands, which requires Nuxt >= 3.1.

### Add your host name

The `og:image` meta tag requires the full URL, so you must provide your site host.

_nuxt.config.ts_

```ts
export default defineNuxtConfig({
  // Recommended
  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://example.com',
    }
  },
  // OR
  ogImage: {
    host: 'https://example.com',
  },
})
```

# Guides

## Your first Satori `og:image`

For this guide, you will create your Satori OG image using the default component for your home page.

### 1. Define a static OG Image

Within your `pages/index.vue`, use `defineOgImageStatic` or `OgImageStatic` to define your `og:image` component.

Make sure you have defined some metadata as props will be inferred from it.

```vue
<script lang="ts" setup>
// 1. make sure you have some meta
useSeoMeta({
  title: 'Home',
  description: 'My awesome home page.',
})
// 2a. Use the Composition API
defineOgImageStatic()
</script>

<template>
  <div>
    <!-- 2b. OR Component API -->
    <OgImageStatic />
  </div>
</template>
```

### 2. View your `og:image`

Appending `/__og_image__` to the end of the URL will show you the playground for that pages `og:image`. This provides
a live preview of your `og:image` and allows you to edit it in real-time.

For example, if your local site is hosted at `http://localhost:3000`, you can view your `og:image` at `http://localhost:3000/__og_image__`.

### 3. Customize your `og:image`

While you have the playground open, start customising the OG Image by providing options to the `defineOgImageStatic` function.

```vue
<script lang="ts" setup>
defineOgImageStatic({
  title: 'Welcome to my site!',
  background: 'lightblue'
})
</script>
```

Congrats, you've set up your first Satori `og:image`! You can checkout the [options](./src/runtime/components/OgImageBasic.island.vue) of the default template.

## Making your own Satori template

Templates for OG images are powered by Nuxt Islands, which are just Vue components. In this guide we'll create a new 
template and use it for our `og:image`.

### 1. Create an island component

Make a folder in your components directory called `islands`. 

Within this directory make a new component called `MyOgImage.vue`, 
you can use the following template to begin:

```vue
<script setup lang="ts">
const props = defineProps({
  title: String,
})
</script>

<template>
  <div class="w-full h-full flex text-white bg-blue-500 items-center justify-center">
    <h1 :style="{ fontSize: '70px' }">
      {{ title }} 👋
    </h1>
  </div>
</template>
```

### 2. Use the new template

Now that you have your template, you can use it in for your `defineOgImageStatic` function.

```vue
<script lang="ts" setup>
defineOgImageStatic({
  component: 'MyOgImage',
  title: 'Welcome to my site!'
})
</script>
```

View this image in your browser by appending `/__og_image__` to the end of the URL.

### 3. Customize your template

Now that you have your template, you can start customizing it.

Any options you pass to the `defineOgImageStatic` composable will be available in the component. With this in mind, we can
add support for changing the background color.

```vue
<script setup lang="ts">
const props = defineProps({
  title: String,
  backgroundColor: String
})
</script>

<template>
  <div :class="[backgroundColor]" class="w-full h-full flex text-white items-center justify-center">
    <h1 :style="{ fontSize: '70px' }">
      {{ title }} 👋
    </h1>
  </div>
</template>
```

Now let's customise the background to be green instead.

```vue
<script lang="ts" setup>
defineOgImageStatic({
  component: 'MyOgImage',
  title: 'Welcome to my site!',
  backgroundColor: 'bg-green-500'
})
</script>
```

Within the playground, you should now see the background color change to green.

## Using Satori

It's important to familiarize yourself with [Satori](https://github.com/vercel/satori) before you make more complex templates.

Satori has limited capacity for rendering styles;
you should reference which ones are available within their documentation.

Out of the box, this module provides support for the following:
- Tailwind classes (Note: Satori Tailwind support is experimental, not all classes are supported)
- Google Fonts, default is Inter
- Emoji support with [Twemoji](https://github.com/twitter/twemoji)
- Relative image support (you should link images from your public directory `/my-image.png`)

If you find Satori is too limiting for your needs, you can always use the `browser` provider to capture browser screenshots instead.

## Taking screenshots

If you want to simply take a screenshot of your page, you can use the `OgImageScreenshot` component or `defineOgImageScreenshot` composable.

```vue
<script lang="ts" setup>
defineOgImageScreenshot()
</script>
```

Alternatively you can pass the `{ provider: 'browser' }` option to `defineOgImageStatic`.

```vue
<script lang="ts" setup>
defineOgImageStatic({
  component: 'MyAwesomeOgImage',
  // this will take a browser screenshot
  provider: 'browser'
})
</script>
```

### Requirements

If you don't have a chromium binary installed on your system, run `npx playwright install`.

If you are using this module in a CI context and the images aren't being generated,
you may need to install a chromium binary.

You can do this by running `npx playwright install` within your build command.

_package.json_

```json
{
  "scripts": {
    "build": "npx playwright install && nuxt build"
  }
}
```

# API

The module exposes a composition and component API to implement your `og:image` generation. You should pick
whichever one you prefer using.

## OgImageStatic / defineOgImageStatic

The `OgImageStatic` component and the `defineOgImageStatic` composable creates a static image
that will be pre-rendered.

The options follow the [OgImageOptions](#OgImageOptions) interface,
any additional options will be passed to the `component` as props.

It is useful for images that do not change at runtime.

### Example

```vue
<script setup lang="ts">
// a. Composition API
defineOgImageStatic({
  component: 'MyOgImageTemplate',
  title: 'Hello world',
  theme: 'dark'
})
</script>

<template>
  <!-- b. Component API -->
  <OgImageStatic
    component="MyOgImageTemplate"
    title="Hello world"
    theme="dark"
  />
</template>
```


## OgImageDynamic / defineOgImageDynamic

The `OgImageDynamic` component and the `defineOgImageDynamic` composable creates a dynamic image. They are not pre-rendered and will
be generated at runtime.

The options follow the [OgImageOptions](#OgImageOptions) interface,
any additional options will be passed to the `component` as props.

This feature is not compatible with static sites built using `nuxi generate`.

### Example

```vue
<script setup lang="ts">
const dynamicData = await fetch('https://example.com/api')

// a. Composition API
defineOgImageDynamic({
  component: 'MyOgImageTemplate',
  title: 'Hello world',
  dynamicData,
})
</script>

<template>
  <!-- b. Component API -->
  <OgImageDynamic
    component="MyOgImageTemplate"
    title="Hello world"
    :dynamic-data="dynamicData"
  />
</template>
```


## OgImageOptions

### `alt`

- Type: `string`
- Default: `''`
- Required: `false`

The `og:image:alt` attribute for the image. It should describe the contents of the image.

### `height`

- Type: `number`
- Default: `630`
- Required: `true`

The height of the screenshot. Will be used to generate the `og:image:height` meta tag.

### `width`

- Type: `number`
- Default: `1200`
- Required: `true`

The width of the screenshot. Will be used to generate the `og:image:width` meta tag.

### `component`

- Type: `string`
- Default: `OgImageBasic`
- Required: `true`

The name of the component to use as the template. By default, it uses OgImageBasic provided by the module.

### `provider`

- Type: `string`
- Default: `satori`
- Required: `false`

The provider to use to generate the image. The default provider is `satori`.
When you use `browser` it will use Puppeteer to generate the image.

### `prerender`

- Type: `boolean`
- Default: `true` when static, `false` when dynamic


## OgImageScreenshot / defineOgImageScreenshot

The `OgImageScreenshot` component and the `defineOgImageScreenshot` composable creates a screenshot of a page using a browser.

The options follow the [ScreenshotsOptions](#ScreenshotsOptions) interface.


### Example

```vue
<script setup lang="ts">
// a. Composition API
defineOgImageScreenshot({
  // wait for animations
  delay: 1000,
})
</script>

<template>
  <!-- b. Component API -->
  <OgImageScreenshot
    url="https://example.com"
    title="Hello world"
    theme="dark"
  />
</template>
```

### ScreenshotsOptions

This interface extends the [OgImageOptions](#OgImageOptions).

#### `colorScheme`

- Type: `'dark' | 'light'`
- Default: `light`
- Required: `false`

The color scheme to use when generating the image. This is useful for generating dark mode images.

```ts
defineOgImageScreenshot({
  colorScheme: 'dark'
})
```

#### `delay`

- Type: `number`
- Default: `0`
- Required: `false`

The delay to wait before taking the screenshot. This is useful if you want to wait for animations to complete.

```ts
defineOgImageScreenshot({
  // wait 2 seconds
  delay: 2000
})
```

#### `mask`

- Type: `string`
- Default: `undefined`
- Required: `false`

HTML selectors that should be removed from the image. Useful for removing popup banners or other elements that may be in the way.

```ts
defineOgImageScreenshot({
  mask: '.popup-banner, .cookie-banner'
})
```

#### `selector`

- Type: `string`
- Default: `undefined`
- Required: `false`

The selector to take a screenshot of. This is useful if you want to exclude header / footer elements.

```ts
defineOgImageScreenshot({
  selector: '.page-content'
})
```

## Module Config

### `host`

- Type: `string`
- Default: `undefined`
- Required: `true`

The host of your site. This is required to generate the absolute path of the `og:image`.

### `defaults`

- Type: `OgImageOptions`
- Default: `{ component: 'OgImageBasic', width: 1200, height: 630, }`
- Required: `false`

The default options to use when generating images.

### `forcePrerender`

- Type: `boolean`
- Default: `false`
- Required: `false`

This is enabled when you run `nuxi generate`. It forces all OG images to be pre-rendered as the server is not available to generate
runtime images.

### `fonts`

- Type: ``${string}:${number}`[]`
- Default: `['Inter:400', 'Inter:700']`
- Required: `false`

Fonts families to use when generating images with Satori. When not using Inter it will automatically fetch the font from Google Fonts.

For example, if you wanted to add the Roboto font, you would add the following:

```ts
export default defineNuxtConfig({
  ogImage: {
    fonts: ['Roboto:400', 'Roboto:700']
  }
})
```

### `satoriOptions`

- Type: `SatoriOptions`
- Default: `{}`
- Required: `false`

Options to pass to Satori when generating images. See the [Satori docs](https://github.com/vercel/satori).

### `experimentalNitroBrowser` (experimental)

- Type: `boolean`
- Default: `false`
- Required: `false`

In a server runtime, the default behaviour is to generate images using Satori. If you'd like to generate runtime images using the a browser instance 
for screenshots, you can enable this setting.

This is experimental and may not work in all environments.

## Examples

- [Unhead Docs](https://github.com/unjs/unhead/tree/main/docs)
- [harlanzw.com](https://github.com/harlan-zw/harlanzw.com)

## Sponsors

<p align="center">
  <a href="https://raw.githubusercontent.com/harlan-zw/static/main/sponsors.svg">
    <img src='https://raw.githubusercontent.com/harlan-zw/static/main/sponsors.svg'/>
  </a>
</p>

## Credits

- Pooya Parsa [Kachick](https://github.com/unjs/kachik)
- Anthony Fu (Nuxt Devtools)
- Nuxt Team

## License

MIT License © 2023-PRESENT [Harlan Wilton](https://github.com/harlan-zw)
