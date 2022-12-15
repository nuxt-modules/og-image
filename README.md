<h1 align='center'>nuxt-og-image</h1>

<p align="center">
<a href='https://github.com/harlan-zw/nuxt-og-image/actions/workflows/test.yml'>
</a>
<a href="https://www.npmjs.com/package/nuxt-og-image" target="__blank"><img src="https://img.shields.io/npm/v/nuxt-og-image?style=flat&colorA=002438&colorB=28CF8D" alt="NPM version"></a>
<a href="https://www.npmjs.com/package/nuxt-og-image" target="__blank"><img alt="NPM Downloads" src="https://img.shields.io/npm/dm/nuxt-og-image?flat&colorA=002438&colorB=28CF8D"></a>
<a href="https://github.com/harlan-zw/nuxt-og-image" target="__blank"><img alt="GitHub stars" src="https://img.shields.io/github/stars/harlan-zw/nuxt-og-image?flat&colorA=002438&colorB=28CF8D"></a>
</p>


<p align="center">
Generate social share images for your pre-rendered Nuxt v3 app.
</p>

<p align="center">
<table>
<tbody>
<td align="center">
<img width="800" height="0" /><br>
<i>Status:</i> Early Access</b> <br>
<sup> Please report any issues 🐛</sup><br>
<sub>Made possible by my <a href="https://github.com/sponsors/harlan-zw">Sponsor Program 💖</a><br> Follow me <a href="https://twitter.com/harlan_zw">@harlan_zw</a> 🐦 • Join <a href="https://discord.gg/275MBUBvgP">Discord</a> for help</sub><br>
<img width="800" height="0" />
</td>
</tbody>
</table>
</p>

## Features

- 🔄 Configure using route rules
- 📸 Generates site screenshots
- 🎨 OR build your own template with Vue (powered by Nuxt islands)

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

To have routes included for og:image creation automatically, they need to be pre-rendered by Nitro.

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

## Default Behaviour

By default, all pre-rendered routes will generate an og:image of a screenshot of the page.

## Using a template

You can create your own template to use for generating og:image. This is done with 
Nuxt islands.

### Requirements

To use this feature you will need to opt in to the edge channel, see [the instructions](https://nuxt.com/docs/guide/going-further/edge-channel#edge-release-channel).

The `componentIslands` experimental feature is required for this module to work and will is enabled for you.

### Setup

#### Create the Island component

Firstly, you're going to create the Vue component to be used to render the og:image.

Create the file at `components/islands/OgImageDefault.vue`.

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

#### Configure the payload

Within a page 

### Set host

You'll need to provide the host of your site in order to generate the sitemap.xml.

```ts
export default defineNuxtConfig({
  // Recommended 
  runtimeConfig: {
    siteUrl: 'https://example.com',
  },
  // OR 
  sitemap: {
    hostname: 'https://example.com',
  },
})
```


## Route Rules

To change the behavior of the sitemap, you can use route rules. Route rules are provided as [Nitro route rules](https://v3.nuxtjs.org/docs/directory-structure/nitro/#route-rules).

_nuxt.config.ts_

```ts
export default defineNuxtConfig({
  routeRules: {
    // Don't add any /secret/** URLs to the sitemap  
    '/secret/**': { index: false },
    // modify the sitemap entry for specific URLs
    '/about': { sitemap: { changefreq: 'daily', priority: 0.3 } }
  }
})
```

The following options are available for each route rule:

- `index`: Whether to include the route in the sitemap.xml. Defaults to `true`.
- `sitemap.changefreq`: The change frequency of the route.
- `sitemap.priority`: The priority of the route. 

## Module Config

If you need further control over the sitemap URLs, you can provide config on the `sitemap` key.

### `host`

- Type: `string`
- Default: `undefined`
- Required: `true`

The host of your site. This is required to generate the sitemap.xml.

### `trailingSlash`

- Type: `boolean`
- Default: `false`

Whether to add a trailing slash to the URLs in the sitemap.xml.

### `enabled`

- Type: `boolean`
- Default: `true`

Whether to generate the sitemap.xml.

### `include`

- Type: `string[]`
- Default: `undefined`

Filter routes that match the given rules.

```ts
export default defineNuxtConfig({
  sitemap: {
    include: [
      '/my-hidden-url'
    ]
  }
})
```

### `exclude`

- Type: `string[]`
- Default: `undefined`

Filter routes that match the given rules.

```ts
export default defineNuxtConfig({
  sitemap: {
    exclude: [
        '/my-secret-section/**'
    ]
  }
})
```

Additional config extends [sitemap.js](https://github.com/ekalinin/sitemap.js).

## Examples

### Add custom routes without pre-rendering

```ts
export default defineNuxtConfig({
  hooks: {
      'sitemap:generate': (ctx) => {
          // add custom URLs
          ctx.urls.push({
              url: '/my-custom-url',
              changefreq: 'daily',
              priority: 0.3
          })
      }
  }
})
```

## Sponsors

<p align="center">
  <a href="https://raw.githubusercontent.com/harlan-zw/static/main/sponsors.svg">
    <img src='https://raw.githubusercontent.com/harlan-zw/static/main/sponsors.svg'/>
  </a>
</p>


## License

MIT License © 2022-PRESENT [Harlan Wilton](https://github.com/harlan-zw)
