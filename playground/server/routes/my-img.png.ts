import { defineEventHandler, setHeader } from 'h3'

export default defineEventHandler((e) => {
  // return a simple png
  setHeader(e, 'Content-Type', 'image/png')
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
})
