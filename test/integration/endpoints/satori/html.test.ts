import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../../../fixtures/basic'),
})
describe('html', () => {
  it('basic', async () => {
    const font = await $fetch('/__og-image__/image/satori/og.html')
    expect(font).toMatchInlineSnapshot(`
      "<!DOCTYPE html>
      <html >
      <head><meta charset=\\"utf-8\\">
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
      img.emoji {
         height: 1em;
         width: 1em;
         margin: 0 .05em 0 .1em;
         vertical-align: -0.1em;
      }</style>
      <script src=\\"https://cdn.tailwindcss.com\\"></script>
      <script>tailwind.config = {
        corePlugins: {
          preflight: false,
        },
        theme: {}
      }</script>
      <link href=\\"https://cdn.jsdelivr.net/npm/gardevoir\\" rel=\\"stylesheet\\">
      <link href=\\"https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap\\" rel=\\"stylesheet\\"></head>
      <body ><div data-v-inspector-ignore=\\"true\\" style=\\"position: relative; display: flex; margin: 0 auto; width: 1200px; height: 600px; overflow: hidden;\\"><!--[--><div style=\\"display:flex;position:absolute;width:100%;height:100%;background:rgba(5, 5, 5,1);\\"></div><div style=\\"display:flex;position:absolute;right:-100%;top:0%;width:200%;height:200%;background-image:radial-gradient(circle, rgba(0, 220, 130, 0.5) 0%,  rgba(5, 5, 5,0.3) 50%, rgba(5, 5, 5,0) 70%);\\"></div><div class=\\"w-full h-full flex justify-between text-gray-100 relative\\" style=\\"padding:5rem;\\"><div class=\\"flex flex-row justify-between items-center\\"><div class=\\"flex flex-col w-full\\" style=\\"\\"><div style=\\"font-weight:bold;margin-bottom:50px;font-size:75px;max-width:70%;\\">title</div><!----></div><!----></div><div class=\\"flex flex-row justify-center items-center text-left w-full\\"><!--[--><svg height=\\"50\\" width=\\"50\\" class=\\"mr-3\\" viewBox=\\"0 0 200 200\\" xmlns=\\"http://www.w3.org/2000/svg\\"><path fill=\\"#00dc82\\" d=\\"M62.3,-53.9C74.4,-34.5,73.5,-9,67.1,13.8C60.6,36.5,48.7,56.5,30.7,66.1C12.7,75.7,-11.4,74.8,-31.6,65.2C-51.8,55.7,-67.9,37.4,-73.8,15.7C-79.6,-6,-75.1,-31.2,-61.1,-51C-47.1,-70.9,-23.6,-85.4,0.8,-86C25.1,-86.7,50.2,-73.4,62.3,-53.9Z\\" transform=\\"translate(100 100)\\"></path></svg><div style=\\"font-size:25px;\\" class=\\"font-bold\\">nuxt-og-image</div><!--]--></div></div><!--]--></div></body>
      </html>"
    `)
  }, 60000)
})
