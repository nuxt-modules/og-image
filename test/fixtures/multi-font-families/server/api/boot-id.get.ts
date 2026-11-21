import { defineEventHandler } from 'h3'

// Changes whenever Nitro rebuilds and restarts in dev, so tests can tell a restart apart from a hot update
const bootId = `${process.pid}-${Date.now()}-${Math.random()}`

export default defineEventHandler(() => bootId)
