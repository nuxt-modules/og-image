import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../../fixtures/basic'),
})
describe('html', () => {
  it('basic', async () => {
    const font = await $fetch('/__og-image__/image/og.html')
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
          height: 630px;
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
      <body ><div style=\\"position: relative; display: flex; margin: 0 auto; width: 1200px; height: 630px; overflow: hidden;\\"><!--[--><div style=\\"display:flex;position:absolute;width:100%;height:100%;background:rgba(5, 5, 5,1);\\"></div><div style=\\"display:flex;position:absolute;right:-100%;top:10%;width:200%;height:200%;background-image:radial-gradient(circle, rgba(0,220,130, 0.5) 0%,  rgba(5, 5, 5,0.3) 50%, rgba(5, 5, 5,0) 70%);\\"></div><div class=\\"w-full h-full flex text-gray-100 relative items-center justify-center\\" style=\\"padding:0 100px;\\"><div class=\\"flex flex-row justify-between items-center\\" style=\\"margin-bottom:100px;\\"><div class=\\"flex flex-col w-full\\" style=\\"\\"><div class=\\"\\" style=\\"font-weight:bold;margin-bottom:50px;font-size:75px;\\">Og Image Template</div><div class=\\"\\" style=\\"font-size:35px;line-height:52.5px;opacity:0.8;\\">Set a description to change me.</div></div><!----></div><div class=\\"flex flex-row absolute bottom-10 text-left items-start\\"><div style=\\"font-size:25px;\\" class=\\"font-bold\\">nuxt-og-image</div></div></div><!--]--></div></body>
      </html>"
    `)
  }, 60000)
})
