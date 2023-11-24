import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../../fixtures/basic'),
})
describe('json', () => {
  it('basic', async () => {
    const json = await $fetch('/__og-image__/image/og.json')
    expect(json).toMatchInlineSnapshot(`
      {
        "extension": "json",
        "options": {
          "cache": true,
          "cacheTtl": 86400000,
          "component": "OgImageTemplateFallback",
          "height": 630,
          "path": "/",
          "provider": "satori",
          "requestOrigin": "http://127.0.0.1:37819/",
          "socialPreview": {
            "og": {
              "image": "https://nuxtseo.com/__og-image__/image/og.png",
              "image:height": "630",
              "image:type": "image/png",
              "image:width": "1200",
            },
            "twitter": {
              "card": "summary_large_image",
              "image:height": "630",
              "image:src": "https://nuxtseo.com/__og-image__/image/og.png",
              "image:width": "1200",
            },
          },
          "width": 1200,
        },
        "provider": {
          "name": "satori",
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
                          "backgroundImage": "radial-gradient(circle, rgba(0,220,130, 0.5) 0%,  rgba(5, 5, 5,0.3) 50%, rgba(5, 5, 5,0) 70%)",
                          "display": "flex",
                          "height": "200%",
                          "position": "absolute",
                          "right": "-100%",
                          "top": "10%",
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
                                          "children": "Og Image Template",
                                          "class": "",
                                          "style": {
                                            "fontSize": "75px",
                                            "fontWeight": "bold",
                                            "marginBottom": "50px",
                                          },
                                        },
                                        "type": "div",
                                      },
                                      {
                                        "props": {
                                          "children": "Set a description to change me.",
                                          "class": "",
                                          "style": {
                                            "fontSize": "35px",
                                            "lineHeight": "52.5px",
                                            "opacity": "0.8",
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
                                "marginBottom": "100px",
                              },
                              "tw": "flex flex-row justify-between items-center",
                            },
                            "type": "div",
                          },
                          {
                            "props": {
                              "children": [
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
                              "class": "flex flex-row absolute bottom-10 text-left items-start",
                              "style": {
                                "display": "flex",
                              },
                              "tw": "flex flex-row absolute bottom-10 text-left items-start",
                            },
                            "type": "div",
                          },
                        ],
                        "class": "w-full h-full flex text-gray-100 relative items-center justify-center",
                        "style": {
                          "display": "flex",
                          "flexDirection": "column",
                          "padding": "0 100px",
                        },
                        "tw": "w-full h-full flex text-gray-100 relative items-center justify-center",
                      },
                      "type": "div",
                    },
                  ],
                  "style": {
                    "display": "flex",
                    "height": "630px",
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
