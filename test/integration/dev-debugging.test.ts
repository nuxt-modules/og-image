import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/basic'),
  dev: true,
})

describe('dev', () => {
  it('svg', async () => {
    const svg = await $fetch('/__og-image__/image/satori/og.svg')
    expect(svg).toMatchInlineSnapshot(`
      Blob {
        Symbol(kHandle): Blob {},
        Symbol(kLength): 14686,
        Symbol(kType): "image/svg+xml",
      }
    `)
  }, 60000)

  it('json', async () => {
    const json = await $fetch('/__og-image__/image/satori/og.json')
    delete json.key
    json.options.component = json.options.component.replace('OgImage', '')
    expect(json).toMatchInlineSnapshot(`
      {
        "cacheKey": "satori:5Hzq5ZrLws",
        "compatibilityHints": [],
        "options": {
          "_query": {},
          "cacheMaxAgeSeconds": 259200,
          "component": "NuxtSeo",
          "emojis": "noto",
          "extension": "png",
          "height": 600,
          "props": {
            "title": "Hello World",
          },
          "renderer": "satori",
          "socialPreview": {
            "og": {
              "image": "https://nuxtseo.com/__og-image__/image/satori/og.png",
              "image:height": "600",
              "image:type": "image/png",
              "image:width": "1200",
            },
            "twitter": {
              "card": "summary_large_image",
              "image": "https://nuxtseo.com/__og-image__/image/satori/og.png",
              "image:height": "600",
              "image:src": "https://nuxtseo.com/__og-image__/image/satori/og.png",
              "image:width": "1200",
            },
          },
          "width": 1200,
        },
        "siteConfig": {
          "url": "https://nuxtseo.com",
        },
        "svg": "<svg width="1200" height="600" viewBox="0 0 1200 600" xmlns="http://www.w3.org/2000/svg"><mask id="satori_om-id"><rect x="0" y="0" width="1200" height="600" fill="#fff"/></mask><clipPath id="satori_cp-id-0"><rect x="0" y="0" width="1200" height="600"/></clipPath><mask id="satori_om-id-0"><rect x="0" y="0" width="1200" height="600" fill="#fff"/></mask><mask id="satori_om-id-0-0"><rect x="0" y="0" width="1200" height="600" fill="#fff" mask="url(#satori_om-id-0)"/></mask><rect x="0" y="0" width="1200" height="600" fill="rgb(255, 255, 255)" clip-path="url(#satori_cp-id-0)" mask="url(#satori_om-id-0)"/><defs><pattern id="satori_pattern_id-0-0-0_0" x="0" y="0" width="1" height="1" patternUnits="objectBoundingBox"><radialGradient id="satori_radial_id-0-0-0_0"><stop offset="0" stop-color="rgba(0,220,130,0.5)"/><stop offset="0.5" stop-color="rgba(255,255,255,0.7)"/><stop offset="0.7" stop-color="rgba(255,255,255,0)"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></radialGradient><mask id="satori_mask_id-0-0-0_0"><rect x="0" y="0" width="2160" height="960" fill="#fff"/></mask><rect x="0" y="0" width="2160" height="960" fill="rgba(255,255,255,0)"/><circle cx="1080" cy="480" width="2160" height="960" r="1181.8629362155325" fill="url(#satori_radial_id-0-0-0_0)" mask="url(#satori_mask_id-0-0-0_0)"/></pattern></defs><mask id="satori_om-id-0-0-0"><rect x="120" y="0" width="2160" height="960" fill="#fff" mask="url(#satori_om-id-0)"/></mask><rect x="120" y="0" width="2160" height="960" fill="url(#satori_pattern_id-0-0-0_0)" clip-path="url(#satori_cp-id-0)" mask="url(#satori_om-id-0)"/><mask id="satori_om-id-0-0-1"><rect x="60" y="60" width="1080" height="480" fill="#fff" mask="url(#satori_om-id-0)"/></mask><mask id="satori_om-id-0-0-1-0"><rect x="60" y="60" width="1080" height="121" fill="#fff" mask="url(#satori_om-id-0)"/></mask><mask id="satori_om-id-0-0-1-0-0"><rect x="60" y="60" width="702" height="121" fill="#fff" mask="url(#satori_om-id-0)"/></mask><mask id="satori_om-id-0-0-1-0-0-0"><rect x="60" y="60" width="702" height="91" fill="#fff" mask="url(#satori_om-id-0)"/></mask><path fill="rgb(17, 24, 39)" d="M76.3 132.7L64.7 132.7L64.7 78.1L76.3 78.1L76.3 100.6L99.7 100.6L99.7 78.1L111.2 78.1L111.2 132.7L99.7 132.7L99.7 110.1L76.3 110.1L76.3 132.7ZM139.1 133.5L139.1 133.5Q132.8 133.5 128.3 130.9Q123.7 128.3 121.3 123.6Q118.8 118.9 118.8 112.4L118.8 112.4Q118.8 106.1 121.3 101.3Q123.7 96.5 128.2 93.9Q132.7 91.2 138.7 91.2L138.7 91.2Q142.7 91.2 146.2 92.5Q149.7 93.8 152.4 96.4Q155.0 99.0 156.4 102.9Q157.9 106.8 157.9 112.0L157.9 112.0L157.9 115.1L130.0 115.1L130.0 115.1Q130.0 118.2 131.2 120.4Q132.3 122.6 134.4 123.8Q136.5 125.0 139.3 125.0L139.3 125.0Q141.2 125.0 142.8 124.5Q144.3 123.9 145.5 122.9Q146.6 121.8 147.2 120.2L147.2 120.2L157.7 120.9Q156.9 124.7 154.4 127.5Q151.9 130.3 148.1 131.9Q144.2 133.5 139.1 133.5ZM130.0 108.1L130.0 108.1L147.2 108.1Q147.2 105.6 146.2 103.7Q145.1 101.8 143.2 100.8Q141.3 99.7 138.9 99.7L138.9 99.7Q136.3 99.7 134.3 100.9Q132.3 102.1 131.2 104.0L131.2 104.0Q130.2 105.9 130.0 108.1ZM165.3 78.1L176.7 78.1L176.7 132.7L165.3 132.7L165.3 78.1ZM185.7 78.1L197.1 78.1L197.1 132.7L185.7 132.7L185.7 78.1ZM224.6 133.5L224.6 133.5Q218.4 133.5 213.9 130.8Q209.4 128.2 206.9 123.4Q204.5 118.6 204.5 112.4L204.5 112.4Q204.5 106.0 206.9 101.3Q209.4 96.5 213.9 93.9Q218.4 91.2 224.6 91.2L224.6 91.2Q230.8 91.2 235.3 93.9Q239.8 96.5 242.3 101.3Q244.7 106.0 244.7 112.4L244.7 112.4Q244.7 118.6 242.3 123.4Q239.8 128.2 235.3 130.8Q230.8 133.5 224.6 133.5ZM224.6 124.7L224.6 124.7Q227.5 124.7 229.4 123.1Q231.3 121.4 232.2 118.6Q233.2 115.9 233.2 112.3L233.2 112.3Q233.2 108.7 232.2 105.9Q231.3 103.1 229.4 101.5Q227.5 99.9 224.6 99.9L224.6 99.9Q221.8 99.9 219.9 101.5Q217.9 103.1 217.0 105.9Q216.0 108.7 216.0 112.3L216.0 112.3Q216.0 115.9 217.0 118.6Q217.9 121.4 219.9 123.1Q221.8 124.7 224.6 124.7Z M293.3 132.7L282.0 132.7L266.4 78.1L279.0 78.1L288.0 116.0L288.5 116.0L298.4 78.1L309.2 78.1L319.2 116.1L319.7 116.1L328.7 78.1L341.3 78.1L325.7 132.7L314.4 132.7L304.0 97.0L303.6 97.0L293.3 132.7ZM365.7 133.5L365.7 133.5Q359.5 133.5 355.0 130.8Q350.5 128.2 348.0 123.4Q345.6 118.6 345.6 112.4L345.6 112.4Q345.6 106.0 348.0 101.3Q350.5 96.5 355.0 93.9Q359.5 91.2 365.7 91.2L365.7 91.2Q371.9 91.2 376.4 93.9Q380.9 96.5 383.4 101.3Q385.8 106.0 385.8 112.4L385.8 112.4Q385.8 118.6 383.4 123.4Q380.9 128.2 376.4 130.8Q371.9 133.5 365.7 133.5ZM365.8 124.7L365.8 124.7Q368.6 124.7 370.5 123.1Q372.4 121.4 373.3 118.6Q374.3 115.9 374.3 112.3L374.3 112.3Q374.3 108.7 373.3 105.9Q372.4 103.1 370.5 101.5Q368.6 99.9 365.8 99.9L365.8 99.9Q362.9 99.9 361.0 101.5Q359.0 103.1 358.1 105.9Q357.1 108.7 357.1 112.3L357.1 112.3Q357.1 115.9 358.1 118.6Q359.0 121.4 361.0 123.1Q362.9 124.7 365.8 124.7ZM404.6 132.7L393.2 132.7L393.2 91.7L404.2 91.7L404.2 98.9L404.7 98.9Q405.8 95.1 408.4 93.1Q411.1 91.2 414.5 91.2L414.5 91.2Q415.3 91.2 416.3 91.3Q417.3 91.4 418.1 91.6L418.1 91.6L418.1 101.6Q417.3 101.4 415.9 101.2Q414.4 101.0 413.3 101.0L413.3 101.0Q410.8 101.0 408.8 102.1Q406.8 103.2 405.7 105.1Q404.6 107.0 404.6 109.5L404.6 109.5L404.6 132.7ZM423.9 78.1L435.2 78.1L435.2 132.7L423.9 132.7L423.9 78.1ZM459.4 133.3L459.4 133.3Q454.7 133.3 450.9 130.9Q447.2 128.5 445.0 123.8Q442.8 119.1 442.8 112.3L442.8 112.3Q442.8 105.2 445.0 100.5Q447.3 95.9 451.1 93.5Q454.8 91.2 459.3 91.2L459.3 91.2Q462.8 91.2 465.1 92.4Q467.4 93.5 468.8 95.2Q470.2 97.0 471.0 98.6L471.0 98.6L471.3 98.6L471.3 78.1L482.6 78.1L482.6 132.7L471.5 132.7L471.5 126.1L471.0 126.1Q470.2 127.8 468.7 129.5Q467.3 131.1 465.0 132.2Q462.7 133.3 459.4 133.3ZM463.0 124.3L463.0 124.3Q465.7 124.3 467.6 122.8Q469.5 121.3 470.5 118.6Q471.6 115.9 471.6 112.2L471.6 112.2Q471.6 108.6 470.6 105.9Q469.5 103.2 467.6 101.7Q465.7 100.2 463.0 100.2L463.0 100.2Q460.2 100.2 458.3 101.8Q456.3 103.3 455.3 106.0Q454.4 108.7 454.4 112.2L454.4 112.2Q454.4 115.8 455.4 118.5Q456.4 121.2 458.3 122.8Q460.2 124.3 463.0 124.3Z " clip-path="url(#satori_cp-id-0)" mask="url(#satori_om-id-0)"/><mask id="satori_om-id-0-0-1-1"><rect x="60" y="478" width="1080" height="62" fill="#fff" mask="url(#satori_om-id-0)"/></mask><clipPath id="satori_cp-id-0-0-1-1-0" clip-path="url(#satori_cp-id-0)"><rect x="477" y="484" width="50" height="50"/></clipPath><mask id="satori_om-id-0-0-1-1-0"><rect x="477" y="484" width="50" height="50" fill="#fff" mask="url(#satori_om-id-0)"/></mask><image x="477" y="484" width="50" height="50" href="data:image/svg+xml;utf8,%3Csvg  class=%22%22 xmlns=%22http://www.w3.org/2000/svg%22 tw=%22%22 width=%2250%22 height=%2250%22 viewBox=%220 0 200 200%22%3E%3Cpath fill=%22%2300dc82%22 d=%22M62.3,-53.9C74.4,-34.5,73.5,-9,67.1,13.8C60.6,36.5,48.7,56.5,30.7,66.1C12.7,75.7,-11.4,74.8,-31.6,65.2C-51.8,55.7,-67.9,37.4,-73.8,15.7C-79.6,-6,-75.1,-31.2,-61.1,-51C-47.1,-70.9,-23.6,-85.4,0.8,-86C25.1,-86.7,50.2,-73.4,62.3,-53.9Z%22 transform=%22translate(100 100)%22%3E%3C/path%3E%3C/svg%3E" preserveAspectRatio="none" clip-path="url(#satori_cp-id-0-0-1-1-0)" mask="url(#satori_om-id-0-0-1-1-0)"/><mask id="satori_om-id-0-0-1-1-0-0"><rect x="477" y="484" width="0" height="50" fill="#fff" mask="url(#satori_om-id-0)"/></mask><mask id="satori_om-id-0-0-1-1-1"><rect x="539" y="494" width="185" height="30" fill="#fff" mask="url(#satori_om-id-0)"/></mask><path fill="rgb(17, 24, 39)" d="M544.3 510.3L544.3 510.3L544.3 518.2L540.5 518.2L540.5 504.6L544.1 504.6L544.1 507.0L544.3 507.0Q544.7 505.8 545.8 505.1Q546.9 504.4 548.4 504.4L548.4 504.4Q549.8 504.4 550.9 505.0Q551.9 505.6 552.5 506.8Q553.1 507.9 553.1 509.5L553.1 509.5L553.1 518.2L549.3 518.2L549.3 510.2Q549.3 509.0 548.7 508.3Q548.0 507.5 546.9 507.5L546.9 507.5Q546.1 507.5 545.5 507.9Q544.9 508.2 544.6 508.8Q544.3 509.5 544.3 510.3ZM564.8 512.4L564.8 512.4L564.8 504.6L568.6 504.6L568.6 518.2L564.9 518.2L564.9 515.7L564.8 515.7Q564.3 516.9 563.3 517.7Q562.2 518.4 560.7 518.4L560.7 518.4Q559.3 518.4 558.3 517.8Q557.2 517.2 556.6 516.0Q556.1 514.9 556.1 513.3L556.1 513.3L556.1 504.6L559.8 504.6L559.8 512.6Q559.8 513.8 560.5 514.5Q561.1 515.2 562.2 515.2L562.2 515.2Q562.9 515.2 563.5 514.9Q564.1 514.6 564.4 513.9Q564.8 513.3 564.8 512.4ZM570.9 504.6L574.8 504.6L577.3 509.3L579.8 504.6L583.7 504.6L579.8 511.4L583.8 518.2L580.0 518.2L577.3 513.5L574.6 518.2L570.7 518.2L574.8 511.4L570.9 504.6ZM590.6 504.6L593.2 504.6L593.2 507.4L590.6 507.4L590.6 514.0Q590.6 514.6 590.8 514.8Q591.0 515.1 591.2 515.2Q591.5 515.4 591.9 515.4L591.9 515.4Q592.2 515.4 592.4 515.3Q592.7 515.3 592.9 515.2L592.9 515.2L593.4 518.1Q593.2 518.1 592.6 518.3Q592.1 518.4 591.4 518.4L591.4 518.4Q590.0 518.5 589.0 518.0Q588.0 517.6 587.4 516.7Q586.8 515.9 586.9 514.5L586.9 514.5L586.9 507.4L585.0 507.4L585.0 504.6L586.9 504.6L586.9 501.3L590.6 501.3L590.6 504.6ZM595.9 509.3L604.2 509.3L604.2 512.3L595.9 512.3L595.9 509.3ZM613.5 518.5L613.5 518.5Q611.5 518.5 610.0 517.6Q608.5 516.7 607.6 515.1Q606.8 513.5 606.8 511.5L606.8 511.5Q606.8 509.3 607.6 507.8Q608.5 506.2 610.0 505.3Q611.5 504.4 613.5 504.4L613.5 504.4Q615.6 504.4 617.1 505.3Q618.6 506.2 619.4 507.8Q620.2 509.3 620.2 511.5L620.2 511.5Q620.2 513.5 619.4 515.1Q618.6 516.7 617.1 517.6Q615.6 518.5 613.5 518.5ZM613.6 515.6L613.6 515.6Q614.5 515.6 615.1 515.0Q615.8 514.5 616.1 513.5Q616.4 512.6 616.4 511.4L616.4 511.4Q616.4 510.2 616.1 509.3Q615.8 508.4 615.1 507.8Q614.5 507.3 613.6 507.3L613.6 507.3Q612.6 507.3 612.0 507.8Q611.3 508.4 611.0 509.3Q610.7 510.2 610.7 511.4L610.7 511.4Q610.7 512.6 611.0 513.5Q611.3 514.5 612.0 515.0Q612.6 515.6 613.6 515.6ZM628.9 523.6L628.9 523.6Q627.0 523.6 625.7 523.1Q624.4 522.6 623.6 521.8Q622.9 520.9 622.6 519.8L622.6 519.8L626.1 519.3Q626.3 519.8 626.6 520.1Q627.0 520.5 627.6 520.7Q628.1 520.9 629.0 520.9L629.0 520.9Q630.2 520.9 631.0 520.3Q631.8 519.7 631.8 518.3L631.8 518.3L631.8 515.8L631.6 515.8Q631.4 516.4 630.9 516.9Q630.4 517.4 629.6 517.7Q628.8 518.0 627.7 518.0L627.7 518.0Q626.2 518.0 625.0 517.3Q623.7 516.6 623.0 515.1Q622.2 513.6 622.2 511.4L622.2 511.4Q622.2 509.1 623.0 507.5Q623.7 505.9 625.0 505.2Q626.2 504.4 627.7 504.4L627.7 504.4Q628.9 504.4 629.7 504.8Q630.4 505.2 630.9 505.7Q631.4 506.3 631.6 506.9L631.6 506.9L631.8 506.9L631.8 504.6L635.5 504.6L635.5 518.4Q635.5 520.1 634.7 521.3Q633.8 522.4 632.3 523.0Q630.8 523.6 628.9 523.6ZM628.9 515.2L628.9 515.2Q629.9 515.2 630.5 514.7Q631.1 514.3 631.5 513.4Q631.8 512.6 631.8 511.4L631.8 511.4Q631.8 510.2 631.5 509.3Q631.1 508.4 630.5 507.9Q629.9 507.4 628.9 507.4L628.9 507.4Q628.0 507.4 627.4 507.9Q626.7 508.4 626.4 509.3Q626.1 510.2 626.1 511.4L626.1 511.4Q626.1 512.5 626.4 513.4Q626.7 514.3 627.4 514.7Q628.0 515.2 628.9 515.2ZM638.8 509.3L647.0 509.3L647.0 512.3L638.8 512.3L638.8 509.3ZM654.0 518.2L650.3 518.2L650.3 504.6L654.0 504.6L654.0 518.2ZM652.2 502.8L652.2 502.8Q651.3 502.8 650.7 502.3Q650.1 501.7 650.1 500.9L650.1 500.9Q650.1 500.1 650.7 499.6Q651.3 499.0 652.2 499.0L652.2 499.0Q653.0 499.0 653.6 499.6Q654.2 500.1 654.2 500.9L654.2 500.9Q654.2 501.7 653.6 502.3Q653.0 502.8 652.2 502.8ZM660.8 518.2L657.1 518.2L657.1 504.6L660.7 504.6L660.7 507.0L660.8 507.0Q661.3 505.8 662.3 505.1Q663.2 504.4 664.6 504.4L664.6 504.4Q666.0 504.4 667.0 505.1Q668.0 505.8 668.3 507.0L668.3 507.0L668.5 507.0Q668.9 505.8 670.0 505.1Q671.1 504.4 672.6 504.4L672.6 504.4Q674.5 504.4 675.7 505.6Q676.9 506.8 676.9 509.0L676.9 509.0L676.9 518.2L673.1 518.2L673.1 509.8Q673.1 508.7 672.5 508.1Q671.9 507.5 671.0 507.5L671.0 507.5Q670.0 507.5 669.4 508.2Q668.8 508.8 668.8 509.9L668.8 509.9L668.8 518.2L665.1 518.2L665.1 509.7Q665.1 508.7 664.6 508.1Q664 507.5 663.1 507.5L663.1 507.5Q662.4 507.5 661.9 507.8Q661.4 508.2 661.1 508.7Q660.8 509.3 660.8 510.0L660.8 510.0L660.8 518.2ZM683.8 518.5L683.8 518.5Q682.4 518.5 681.4 518.0Q680.4 517.6 679.8 516.7Q679.2 515.8 679.2 514.4L679.2 514.4Q679.2 513.3 679.6 512.5Q680.1 511.7 680.8 511.3Q681.5 510.8 682.4 510.5Q683.3 510.3 684.3 510.2L684.3 510.2Q685.5 510.1 686.3 510.0Q687.0 509.9 687.3 509.6Q687.7 509.4 687.7 509.0L687.7 509.0L687.7 508.9Q687.7 508.1 687.1 507.6Q686.6 507.2 685.6 507.2L685.6 507.2Q684.6 507.2 684.0 507.6Q683.4 508.1 683.2 508.7L683.2 508.7L679.7 508.5Q680.0 507.2 680.8 506.3Q681.5 505.4 682.8 504.9Q684.0 504.4 685.6 504.4L685.6 504.4Q686.8 504.4 687.8 504.7Q688.9 504.9 689.7 505.5Q690.5 506.1 691.0 506.9Q691.4 507.8 691.4 509.0L691.4 509.0L691.4 518.2L687.8 518.2L687.8 516.3L687.7 516.3Q687.4 517.0 686.9 517.5Q686.3 517.9 685.5 518.2Q684.8 518.5 683.8 518.5ZM684.8 515.9L684.8 515.9Q685.7 515.9 686.3 515.5Q686.9 515.2 687.3 514.6Q687.7 514.1 687.7 513.3L687.7 513.3L687.7 511.9Q687.5 512.0 687.2 512.1Q686.9 512.2 686.5 512.3Q686.1 512.4 685.7 512.4Q685.4 512.5 685.0 512.5L685.0 512.5Q684.4 512.6 683.9 512.8Q683.4 513.0 683.1 513.4Q682.8 513.8 682.8 514.3L682.8 514.3Q682.8 515.1 683.4 515.5Q684.0 515.9 684.8 515.9ZM700.5 523.6L700.5 523.6Q698.7 523.6 697.4 523.1Q696.1 522.6 695.3 521.8Q694.5 520.9 694.3 519.8L694.3 519.8L697.8 519.3Q697.9 519.8 698.3 520.1Q698.6 520.5 699.2 520.7Q699.8 520.9 700.6 520.9L700.6 520.9Q701.8 520.9 702.6 520.3Q703.4 519.7 703.4 518.3L703.4 518.3L703.4 515.8L703.3 515.8Q703.0 516.4 702.5 516.9Q702.0 517.4 701.3 517.7Q700.5 518.0 699.4 518.0L699.4 518.0Q697.9 518.0 696.6 517.3Q695.3 516.6 694.6 515.1Q693.9 513.6 693.9 511.4L693.9 511.4Q693.9 509.1 694.6 507.5Q695.4 505.9 696.6 505.2Q697.9 504.4 699.4 504.4L699.4 504.4Q700.5 504.4 701.3 504.8Q702.1 505.2 702.6 505.7Q703.0 506.3 703.3 506.9L703.3 506.9L703.4 506.9L703.4 504.6L707.2 504.6L707.2 518.4Q707.2 520.1 706.3 521.3Q705.5 522.4 704.0 523.0Q702.5 523.6 700.5 523.6ZM700.6 515.2L700.6 515.2Q701.5 515.2 702.1 514.7Q702.8 514.3 703.1 513.4Q703.5 512.6 703.5 511.4L703.5 511.4Q703.5 510.2 703.1 509.3Q702.8 508.4 702.1 507.9Q701.5 507.4 700.6 507.4L700.6 507.4Q699.7 507.4 699.0 507.9Q698.4 508.4 698.1 509.3Q697.7 510.2 697.7 511.4L697.7 511.4Q697.7 512.5 698.1 513.4Q698.4 514.3 699.0 514.7Q699.7 515.2 700.6 515.2ZM716.4 518.5L716.4 518.5Q714.3 518.5 712.8 517.6Q711.3 516.8 710.5 515.2Q709.6 513.6 709.6 511.5L709.6 511.5Q709.6 509.4 710.5 507.8Q711.3 506.2 712.8 505.3Q714.3 504.4 716.3 504.4L716.3 504.4Q717.6 504.4 718.8 504.8Q719.9 505.3 720.8 506.1Q721.7 507.0 722.2 508.3Q722.7 509.6 722.7 511.3L722.7 511.3L722.7 512.4L713.4 512.4L713.4 512.4Q713.4 513.4 713.8 514.1Q714.1 514.9 714.8 515.3Q715.5 515.7 716.5 515.7L716.5 515.7Q717.1 515.7 717.6 515.5Q718.2 515.3 718.5 515.0Q718.9 514.6 719.1 514.1L719.1 514.1L722.6 514.3Q722.3 515.6 721.5 516.5Q720.7 517.4 719.4 518.0Q718.1 518.5 716.4 518.5ZM713.4 510.0L713.4 510.0L719.1 510.0Q719.1 509.2 718.8 508.6Q718.4 507.9 717.8 507.6Q717.2 507.2 716.3 507.2L716.3 507.2Q715.5 507.2 714.8 507.6Q714.1 508.0 713.8 508.7L713.8 508.7Q713.4 509.3 713.4 510.0Z " clip-path="url(#satori_cp-id-0)" mask="url(#satori_om-id-0)"/></svg>",
        "vnodes": {
          "props": {
            "children": [
              {
                "props": {
                  "children": [
                    {
                      "props": {
                        "children": [
                          {
                            "props": {
                              "class": "",
                              "style": {
                                "backgroundImage": "radial-gradient(circle, rgba(0, 220, 130, 0.5) 0%,  rgba(255, 255, 255, 0.7) 50%, rgba(255, 255, 255, 0) 70%)",
                                "display": "flex",
                                "height": "200%",
                                "position": "absolute",
                                "right": "-100%",
                                "top": "0",
                                "width": "200%",
                              },
                              "tw": "",
                            },
                            "type": "div",
                          },
                          {
                            "props": {
                              "children": [
                                {
                                  "props": {
                                    "children": [
                                      {
                                        "props": {
                                          "children": [
                                            {
                                              "props": {
                                                "children": "Hello World",
                                                "class": "",
                                                "style": {
                                                  "fontSize": "75px",
                                                  "fontWeight": "700",
                                                  "margin": "0",
                                                  "marginBottom": "30px",
                                                },
                                                "tw": "",
                                              },
                                              "type": "h1",
                                            },
                                          ],
                                          "class": "",
                                          "style": {
                                            "display": "flex",
                                            "flexDirection": "column",
                                            "maxWidth": "65%",
                                            "width": "100%",
                                          },
                                          "tw": "",
                                        },
                                        "type": "div",
                                      },
                                    ],
                                    "class": "",
                                    "style": {
                                      "alignItems": "flex-start",
                                      "display": "flex",
                                      "flexDirection": "row",
                                      "justifyContent": "space-between",
                                    },
                                    "tw": "",
                                  },
                                  "type": "div",
                                },
                                {
                                  "props": {
                                    "children": [
                                      null,
                                      {
                                        "props": {
                                          "children": [
                                            {
                                              "props": {
                                                "d": "M62.3,-53.9C74.4,-34.5,73.5,-9,67.1,13.8C60.6,36.5,48.7,56.5,30.7,66.1C12.7,75.7,-11.4,74.8,-31.6,65.2C-51.8,55.7,-67.9,37.4,-73.8,15.7C-79.6,-6,-75.1,-31.2,-61.1,-51C-47.1,-70.9,-23.6,-85.4,0.8,-86C25.1,-86.7,50.2,-73.4,62.3,-53.9Z",
                                                "fill": "#00dc82",
                                                "transform": "translate(100 100)",
                                              },
                                              "type": "path",
                                            },
                                          ],
                                          "class": "",
                                          "height": "50",
                                          "style": {
                                            "marginRight": "0.75rem",
                                          },
                                          "tw": "",
                                          "viewBox": "0 0 200 200",
                                          "width": "50",
                                          "xmlns": "http://www.w3.org/2000/svg",
                                        },
                                        "type": "svg",
                                      },
                                      {
                                        "props": {
                                          "children": "nuxt-og-image",
                                          "class": "",
                                          "style": {
                                            "fontSize": "25px",
                                            "fontWeight": "700",
                                          },
                                          "tw": "",
                                        },
                                        "type": "p",
                                      },
                                    ],
                                    "class": "",
                                    "style": {
                                      "alignItems": "center",
                                      "display": "flex",
                                      "flexDirection": "row",
                                      "justifyContent": "center",
                                      "textAlign": "left",
                                      "width": "100%",
                                    },
                                    "tw": "",
                                  },
                                  "type": "div",
                                },
                              ],
                              "class": "",
                              "style": {
                                "display": "flex",
                                "flexDirection": "column",
                                "height": "100%",
                                "justifyContent": "space-between",
                                "position": "relative",
                                "width": "100%",
                              },
                              "tw": "",
                            },
                            "type": "div",
                          },
                        ],
                        "class": "",
                        "data-island-uid": "",
                        "style": {
                          "backgroundColor": "rgb(255, 255, 255)",
                          "color": "rgb(17, 24, 39)",
                          "display": "flex",
                          "flexDirection": "column",
                          "height": "100%",
                          "justifyContent": "space-between",
                          "padding": "60px",
                          "position": "relative",
                          "width": "100%",
                        },
                        "tw": "",
                      },
                      "type": "div",
                    },
                  ],
                  "style": {
                    "display": "flex",
                    "flexDirection": "column",
                    "height": "600px",
                    "margin": "0 auto",
                    "overflow": "hidden",
                    "position": "relative",
                    "width": "1200px",
                  },
                },
                "type": "div",
              },
            ],
            "style": {
              "display": "flex",
              "flexDirection": "column",
              "height": "100%",
              "width": "100%",
            },
          },
          "type": "div",
        },
      }
    `)
  }, 60000)

  it('html', async () => {
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
      }
      div:has(div, p, ul, ol, li, blockquote, pre, hr, table, dl) {
        display: flex;
        flex-direction: column;
      }
      div:not(:has(div, p, ul, ol, li, blockquote, pre, hr, table, dl)) {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      svg[data-emoji] {
        display: inline-block;
      }
      </style>
      <style>
                @font-face {
                  font-family: 'Inter';
                  font-style: normal;
                  font-weight: 400;
                  src: url('/__og-image__/font/nuxt-og-image:fonts:Inter-400.ttf.base64') format('truetype');
                }
                </style>
      <style>
                @font-face {
                  font-family: 'Inter';
                  font-style: normal;
                  font-weight: 700;
                  src: url('/__og-image__/font/nuxt-og-image:fonts:Inter-700.ttf.base64') format('truetype');
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
      <link href="https://cdn.jsdelivr.net/npm/gardevoir" rel="stylesheet"></head>
      <body ><div data-v-inspector-ignore="true" style="position: relative; display: flex; margin: 0 auto; width: 1200px; height: 600px; overflow: hidden;"><div class="w-full h-full flex justify-between relative p-[60px] bg-white text-gray-900" data-island-uid><div class="flex absolute top-0 right-[-100%]" style="width:200%;height:200%;background-image:radial-gradient(circle, rgba(0, 220, 130, 0.5) 0%,  rgba(255, 255, 255, 0.7) 50%, rgba(255, 255, 255, 0) 70%);"></div><div class="h-full w-full justify-between relative"><div class="flex flex-row justify-between items-start"><div class="flex flex-col w-full max-w-[65%]"><h1 class="m-0 font-bold mb-[30px] text-[75px]">Hello World</h1><!----></div><!----></div><div class="flex flex-row justify-center items-center text-left w-full"><!--[--><svg height="50" width="50" class="mr-3" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><path fill="#00dc82" d="M62.3,-53.9C74.4,-34.5,73.5,-9,67.1,13.8C60.6,36.5,48.7,56.5,30.7,66.1C12.7,75.7,-11.4,74.8,-31.6,65.2C-51.8,55.7,-67.9,37.4,-73.8,15.7C-79.6,-6,-75.1,-31.2,-61.1,-51C-47.1,-70.9,-23.6,-85.4,0.8,-86C25.1,-86.7,50.2,-73.4,62.3,-53.9Z" transform="translate(100 100)"></path></svg><p style="font-size:25px;" class="font-bold">nuxt-og-image</p><!--]--></div></div></div></div></body>
      </html>"
    `)
  }, 60000)
  it('debug.json', async () => {
    const debug = await $fetch('/__og-image__/debug.json')
    delete debug.runtimeConfig.baseCacheKey
    delete debug.runtimeConfig.version
    delete debug.componentNames
    delete debug.baseCacheKey
    delete debug.compatibility.chromium // github ci will have playwright
    expect(debug).toMatchInlineSnapshot(`
      {
        "compatibility": {
          "css-inline": "node",
          "resvg": "node",
          "satori": "node",
          "sharp": false,
        },
        "runtimeConfig": {
          "colorPreference": "light",
          "debug": true,
          "defaults": {
            "cacheMaxAgeSeconds": 259200,
            "component": "NuxtSeo",
            "emojis": "noto",
            "extension": "png",
            "height": 600,
            "renderer": "satori",
            "width": 1200,
          },
          "fonts": [
            {
              "cacheKey": "Inter:400",
              "key": "nuxt-og-image:fonts:Inter-400.ttf.base64",
              "name": "Inter",
              "style": "normal",
              "weight": 400,
            },
            {
              "cacheKey": "Inter:700",
              "key": "nuxt-og-image:fonts:Inter-700.ttf.base64",
              "name": "Inter",
              "style": "normal",
              "weight": 700,
            },
          ],
          "hasNuxtIcon": false,
          "isNuxtContentDocumentDriven": false,
          "publicStoragePath": "root:public",
          "resvgOptions": {},
          "satoriOptions": {},
          "sharpOptions": {},
        },
      }
    `)
  }, 60000)
})
