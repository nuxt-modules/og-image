<h1 align='center'>nuxt-og-image</h1>

<p align="center">
<a href='https://github.com/nuxt-modules/og-image/actions/workflows/test.yml'>
</a>
<a href="https://www.npmjs.com/package/nuxt-og-image" target="__blank"><img src="https://img.shields.io/npm/v/nuxt-og-image?style=flat&colorA=002438&colorB=28CF8D" alt="NPM version"></a>
<a href="https://www.npmjs.com/package/nuxt-og-image" target="__blank"><img alt="NPM Downloads" src="https://img.shields.io/npm/dm/nuxt-og-image?flat&colorA=002438&colorB=28CF8D"></a>
<a href="https://github.com/nuxt-modules/og-image" target="__blank"><img alt="GitHub stars" src="https://img.shields.io/github/stars/nuxt-modules/og-image?flat&colorA=002438&colorB=28CF8D"></a>
</p>

<p align="center">
Generate OG Images with Vue templates in Nuxt.
</p>

<img src="https://github.com/nuxt-modules/og-image/assets/5326365/e337b490-dccb-4e58-972a-5e6e63f30986" alt="Nuxt OG Image DevTools Preview">

<p align="center">
<table>
<tbody>
<td align="center">
<img width="800" height="0" /><br>
<i>Status:</i> <a href="https://nuxtseo.com/og-image/releases/v3">v3 RC is available</a></b> <br>
<sup> Please report any issues 🐛</sup><br>
<sub>Made possible by my <a href="https://github.com/sponsors/harlan-zw">Sponsor Program 💖</a><br> Follow me <a href="https://twitter.com/harlan_zw">@harlan_zw</a> 🐦 • Join <a href="https://discord.gg/275MBUBvgP">Discord</a> for help</sub><br>
<img width="800" height="0" />
</td>
</tbody>
</table>
</p>

## Features

- ✨ Create an `og:image` using the built-in templates or make your own with Vue components
- 🎨 Design and test your `og:image` in the Nuxt DevTools OG Image Playground with full HMR
- ▲ Render using [Satori](https://github.com/vercel/satori): Tailwind / UnoCSS with your theme, Google fonts, 6 emoji families supported and more!
- 🤖 Or prerender using the Browser: Supporting painless, complex templates
- 📸 Feeling lazy? Just generate screenshots for every page: hide elements, wait for animations, and more
- ⚙️ Works on the edge: Vercel Edge, Netlify Edge and Cloudflare Workers

## Installation

1. Install `nuxt-og-image` dependency to your project:

```bash
#
yarn add -D nuxt-og-image
#
npm install -D nuxt-og-image
#
pnpm i -D nuxt-og-image
```

2. Add it to your `modules` section in your `nuxt.config`:

```ts
export default defineNuxtConfig({
  modules: ['nuxt-og-image']
})
```

## Playgrounds

- [StackBlitz - Minimal Playground Example](https://stackblitz.com/edit/nuxt-starter-pxs3wk?file=pages/index.vue)
- [StackBlitz - Alpine Theme](https://stackblitz.com/edit/github-hgunsf?file=package.json)

# Documentation

[📖 Read the full documentation](https://nuxtseo.com/og-image/getting-started/installation) for more information.

## Sponsors

<p align="center">
  <a href="https://raw.githubusercontent.com/harlan-zw/static/main/sponsors.svg">
    <img src='https://raw.githubusercontent.com/harlan-zw/static/main/sponsors.svg'/>
  </a>
</p>

## License

MIT License © 2023-PRESENT [Harlan Wilton](https://github.com/harlan-zw)
