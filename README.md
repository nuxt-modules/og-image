<h1 align='center'>nuxt-og-image</h1>

<p align="center">
<a href='https://github.com/harlan-zw/nuxt-og-image/actions/workflows/test.yml'>
</a>
<a href="https://www.npmjs.com/package/nuxt-og-image" target="__blank"><img src="https://img.shields.io/npm/v/nuxt-og-image?style=flat&colorA=002438&colorB=28CF8D" alt="NPM version"></a>
<a href="https://www.npmjs.com/package/nuxt-og-image" target="__blank"><img alt="NPM Downloads" src="https://img.shields.io/npm/dm/nuxt-og-image?flat&colorA=002438&colorB=28CF8D"></a>
<a href="https://github.com/harlan-zw/nuxt-og-image" target="__blank"><img alt="GitHub stars" src="https://img.shields.io/github/stars/harlan-zw/nuxt-og-image?flat&colorA=002438&colorB=28CF8D"></a>
</p>


<p align="center">
A simple sitemap module for pre-rendered Nuxt v3 apps.
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

- 🔄 Route config using route rules
- 🪝 Easily hook into the sitemap generation
- 📦 Uses [sitemap.js](https://github.com/ekalinin/sitemap.js/)

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

To have routes included in the sitemap.xml automatically, they need to be pre-rendered by Nitro.

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

Note: The sitemap.xml will only be generated once you build your site.


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
