<h1 align='center'>nuxt-og-image</h1>

<p align="center">
<a href='https://github.com/harlan-zw/nuxt-og-image/actions/workflows/test.yml'>
</a>
<a href="https://www.npmjs.com/package/nuxt-og-image" target="__blank"><img src="https://img.shields.io/npm/v/nuxt-og-image?style=flat&colorA=002438&colorB=28CF8D" alt="NPM version"></a>
<a href="https://www.npmjs.com/package/nuxt-og-image" target="__blank"><img alt="NPM Downloads" src="https://img.shields.io/npm/dm/nuxt-og-image?flat&colorA=002438&colorB=28CF8D"></a>
<a href="https://github.com/harlan-zw/nuxt-og-image" target="__blank"><img alt="GitHub stars" src="https://img.shields.io/github/stars/harlan-zw/nuxt-og-image?flat&colorA=002438&colorB=28CF8D"></a>
</p>


<p align="center">
Generate dynamic social share images for you Nuxt v3 app.
</p>

<p align="center">
<table>
<tbody>
<td align="center">
<img width="800" height="0" /><br>
<i>Status:</i> 🤫 Early Access - Active Development 🤫</b> <br>
<sup> Please report any issues 🐛</sup><br>
<sub>Made possible by my <a href="https://github.com/sponsors/harlan-zw">Sponsor Program 💖</a><br> Follow me <a href="https://twitter.com/harlan_zw">@harlan_zw</a> 🐦 • Join <a href="https://discord.gg/275MBUBvgP">Discord</a> for help</sub><br>
<img width="800" height="0" />
</td>
</tbody>
</table>
</p>

## Features

- 🧙 Generate images for your entire site in minutes with minimal config
- 🎨 Build your own template with Vue (powered by Nuxt Islands)
- 📸 OR just generates page screenshots

## Install

```bash
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

### Pre-render routes

While the module is in early access, you should ensure that you pre-render any pages you want to 
generate images for.

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

### Recommended: Enable Nuxt Islands

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

## Generating Screenshots

```vue
<script lang="ts" setup>
defineOgImageScreenshot()
</script>
<template>
  <div>
    <!-- Your page / app.vue / layout -->
  </div>
</template>
```

## Generating Template Images

```vue
<script lang="ts" setup>
defineOgImage({
  component: 'OgImage', // Nuxt Island component
  // pass in any custom props
  myCustomTitle: 'My Title'
})
</script>
<template>
  <div>
    <!-- Your page / app.vue / layout -->
  </div>
</template>
```

#### Create a template

The template used to generate the image must be a Nuxt Island component.

It works the same way as a regular Vue component.

For example, create the file at `components/Banner.island.vue`.

```vue
<script setup lang="ts">
const props = defineProps({
  // payload props
  path: String,
  title: String,
  description: String,
  // add your own props here
  myCustomProp: String
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
  font-weight: bold;
  font-family: sans-serif;
  background: linear-gradient(to bottom, #30e8bf, #ff8235);
}

h1 {
  font-size: 4rem;
  margin: 0;
}
</style>
```

## Previewing Images

Once you have defined the og:image using the composable, you can preview the image by visiting
the following URLs:
- `/your-path/__og-image` Renders the HTML output
- `/your-path/og-image.png` Renders the og:image

## Module Config

If you need further control over the sitemap URLs, you can provide config on the `sitemap` key.

### `host`

- Type: `string`
- Default: `undefined`
- Required: `true`

The host of your site. This is required to generate the absolute path of the og:image.

### `runtimeImages`

- Type: `boolean`
- Default: `process.dev`

Allows you to generate images at runtime in production. This uses a headless browser to generate images
and may have deployment issues.

## Sponsors

<p align="center">
  <a href="https://raw.githubusercontent.com/harlan-zw/static/main/sponsors.svg">
    <img src='https://raw.githubusercontent.com/harlan-zw/static/main/sponsors.svg'/>
  </a>
</p>


## License

MIT License © 2022-PRESENT [Harlan Wilton](https://github.com/harlan-zw)
