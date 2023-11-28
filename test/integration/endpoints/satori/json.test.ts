import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../../../fixtures/basic'),
})
describe('json', () => {
  it('basic', async () => {
    const json = await $fetch('/__og-image__/image/satori/og.json')
    expect(json).toMatchInlineSnapshot(`
      {
        "extension": "json",
        "options": {
          "cache": true,
          "cacheTtl": 86400000,
          "component": "Fallback",
          "extension": "jpg",
          "height": 600,
          "path": "/satori",
          "renderer": "satori",
          "width": 1200,
        },
        "renderer": {
          "name": "satori",
          "supportedFormats": [
            "svg",
            "png",
            "jpeg",
            "jpg",
            "json",
          ],
        },
        "siteConfig": {
          "_context": {
            "defaultLocale": "defaults",
            "description": "package.json",
            "env": "system",
            "indexable": "computed-env",
            "name": "package.json",
            "trailingSlash": "defaults",
            "url": "nuxt-site-config:config",
          },
          "defaultLocale": "en",
          "description": "Enlightened OG Image generation for Nuxt.",
          "env": "test",
          "indexable": false,
          "name": "nuxt-og-image",
          "trailingSlash": false,
          "url": "https://nuxtseo.com",
        },
        "vnodes": {
          "props": {
            "children": [
              {
                "props": {
                  "children": [
                    null,
                    {
                      "props": {
                        "style": {
                          "background": "rgba(5, 5, 5,1)",
                          "display": "flex",
                          "height": "100%",
                          "position": "absolute",
                          "width": "100%",
                        },
                      },
                      "type": "div",
                    },
                    {
                      "props": {
                        "style": {
                          "backgroundImage": "radial-gradient(circle, rgba(0, 220, 130, 0.5) 0%,  rgba(5, 5, 5,0.3) 50%, rgba(5, 5, 5,0) 70%)",
                          "display": "flex",
                          "height": "200%",
                          "position": "absolute",
                          "right": "-100%",
                          "top": "0%",
                          "width": "200%",
                        },
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
                                          "children": "title",
                                          "style": {
                                            "fontSize": "75px",
                                            "fontWeight": "bold",
                                            "marginBottom": "50px",
                                            "maxWidth": "70%",
                                          },
                                        },
                                        "type": "div",
                                      },
                                    ],
                                    "class": "flex flex-col w-full",
                                    "style": {
                                      "display": "flex",
                                    },
                                    "tw": "flex flex-col w-full",
                                  },
                                  "type": "div",
                                },
                              ],
                              "class": "flex flex-row justify-between items-center",
                              "style": {
                                "display": "flex",
                              },
                              "tw": "flex flex-row justify-between items-center",
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
                                    "class": "mr-3",
                                    "height": "50",
                                    "tw": "mr-3",
                                    "viewBox": "0 0 200 200",
                                    "width": "50",
                                    "xmlns": "http://www.w3.org/2000/svg",
                                  },
                                  "type": "svg",
                                },
                                {
                                  "props": {
                                    "children": "nuxt-og-image",
                                    "class": "font-bold",
                                    "style": {
                                      "fontSize": "25px",
                                    },
                                    "tw": "font-bold",
                                  },
                                  "type": "div",
                                },
                              ],
                              "class": "flex flex-row justify-center items-center text-left w-full",
                              "style": {
                                "display": "flex",
                              },
                              "tw": "flex flex-row justify-center items-center text-left w-full",
                            },
                            "type": "div",
                          },
                        ],
                        "class": "w-full h-full flex justify-between text-gray-100 relative",
                        "style": {
                          "display": "flex",
                          "flexDirection": "column",
                          "padding": "5rem",
                        },
                        "tw": "w-full h-full flex justify-between text-gray-100 relative",
                      },
                      "type": "div",
                    },
                  ],
                  "data-v-inspector-ignore": "true",
                  "style": {
                    "display": "flex",
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
})
