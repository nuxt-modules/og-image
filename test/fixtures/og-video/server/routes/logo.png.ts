import { defineEventHandler, setHeader } from 'h3'

// A 1x1 PNG. Each request counts, so tests can assert how often a render fetched it.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==', 'base64')

export default defineEventHandler((event) => {
  ;(globalThis as any).__ogVideoLogoHits = ((globalThis as any).__ogVideoLogoHits || 0) + 1
  setHeader(event, 'Content-Type', 'image/png')
  return PNG
})
