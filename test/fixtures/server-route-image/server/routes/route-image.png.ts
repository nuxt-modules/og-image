import { defineEventHandler } from 'nuxt/server'

// A 4x4 solid red PNG. Templates stretch it over the whole canvas.
const RED_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWP4z8AARwgWXg4ArpMP8bh5W0YAAAAASUVORK5CYII=', 'base64')

export default defineEventHandler(() => new Response(RED_PNG, { headers: { 'content-type': 'image/png' } }))
