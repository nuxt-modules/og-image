import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../../../fixtures/basic'),
  dev: true,
  server: true,
})
describe('html', () => {
  it('basic', async () => {
    const font = await $fetch('/__og-image__/image/satori/og.html')
    expect(font).toMatchInlineSnapshot(`
      "<!DOCTYPE html>
      <html >
      <head><meta charset="utf-8">
      <style>body { font-family: 'Inter', sans-serif;  }</style>
      <style>body {
          transform: scale(1);
          transform-origin: top left;
          max-height: 100vh;
          position: relative;
          width: 1200px;
          height: 600px;
          overflow: hidden;
          background-color: #fff;
      }
      div {
        display: flex;
        flex-direction: column;
      }
      svg[data-emoji] {
        display: inline-block;
      }
      </style>
      <script src="https://cdn.jsdelivr.net/npm/@unocss/runtime/preset-wind.global.js"></script>
      <script>
        window.__unocss = {
          theme: {},
          presets: [
            () => window.__unocss_runtime.presets.presetWind(),
          ],
        }
      </script>
      <script src="https://cdn.jsdelivr.net/npm/@unocss/runtime/core.global.js"></script>
      <link href="https://cdn.jsdelivr.net/npm/gardevoir" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet"></head>
      <body ><div data-v-inspector-ignore="true" style="position: relative; display: flex; margin: 0 auto; width: 1200px; height: 600px; overflow: hidden;"><div class="w-full h-full flex justify-between relative p-[60px] bg-white text-gray-900" data-island-uid><div class="flex absolute top-0 right-[-100%]" style="width:200%;height:200%;background-image:radial-gradient(circle, rgba(0, 220, 130, 0.5) 0%,  rgba(255, 255, 255, 0.7) 50%, rgba(255, 255, 255, 0) 70%);"></div><div class="h-full w-full justify-between relative"><div class="flex flex-row justify-between items-start"><div class="flex flex-col w-full max-w-[65%]"><h1 class="m-0 font-bold mb-[30px] text-[75px]">Hello World</h1><!----></div><!----></div><div class="flex flex-row justify-center items-center text-left w-full"><!--[--><svg height="50" width="50" class="mr-3" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><path fill="#00dc82" d="M62.3,-53.9C74.4,-34.5,73.5,-9,67.1,13.8C60.6,36.5,48.7,56.5,30.7,66.1C12.7,75.7,-11.4,74.8,-31.6,65.2C-51.8,55.7,-67.9,37.4,-73.8,15.7C-79.6,-6,-75.1,-31.2,-61.1,-51C-47.1,-70.9,-23.6,-85.4,0.8,-86C25.1,-86.7,50.2,-73.4,62.3,-53.9Z" transform="translate(100 100)"></path></svg><p style="font-size:25px;" class="font-bold">nuxt-og-image</p><!--]--></div></div></div></div></body>
      </html>"
    `)
  }, 60000)
})
