import { defineEventHandler } from 'h3'

export default defineEventHandler(() => ({ hits: (globalThis as any).__ogVideoLogoHits || 0 }))
