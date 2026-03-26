import { beforeAll, describe, expect, it } from 'vitest'
import { extractPropNamesFromVue, loadSfcCompiler } from '../../src/build/props'

describe('extractPropNamesFromVue', () => {
  beforeAll(async () => {
    await loadSfcCompiler()
  })

  it('extracts from TypeScript generic defineProps', () => {
    const code = `
<script setup lang="ts">
withDefaults(defineProps<{
  colorMode?: 'dark' | 'light'
  title?: string
  description?: string
}>(), {
  colorMode: 'light',
  title: 'title',
})
</script>
<template><div /></template>`
    expect(extractPropNamesFromVue(code)).toEqual(['colorMode', 'title', 'description'])
  })

  it('extracts from TypeScript generic with assignment', () => {
    const code = `
<script setup lang="ts">
const props = withDefaults(defineProps<{
  title?: string
  isPro?: boolean
  width?: number
  height?: number
}>(), {
  title: 'title',
  width: 1200,
  height: 600,
})
</script>
<template><div /></template>`
    expect(extractPropNamesFromVue(code)).toEqual(['title', 'isPro', 'width', 'height'])
  })

  it('extracts from runtime object syntax', () => {
    const code = `
<script setup>
defineProps({
  title: String,
  count: Number,
  active: Boolean,
})
</script>
<template><div /></template>`
    expect(extractPropNamesFromVue(code)).toEqual(['title', 'count', 'active'])
  })

  it('extracts from runtime object with nested type config', () => {
    const code = `
<script setup>
defineProps({
  title: {
    type: String,
    default: 'Hello',
  },
  count: {
    type: Number,
    required: true,
  },
})
</script>
<template><div /></template>`
    expect(extractPropNamesFromVue(code)).toEqual(['title', 'count'])
  })

  it('extracts from array syntax', () => {
    const code = `
<script setup>
defineProps(['title', 'description', 'theme'])
</script>
<template><div /></template>`
    expect(extractPropNamesFromVue(code)).toEqual(['title', 'description', 'theme'])
  })

  it('handles nested generic types in TS props', () => {
    const code = `
<script setup lang="ts">
defineProps<{
  items?: Array<{ id: string, name: string }>
  config?: Record<string, boolean>
  title?: string
}>()
</script>
<template><div /></template>`
    expect(extractPropNamesFromVue(code)).toEqual(['items', 'config', 'title'])
  })

  it('returns empty for components without script setup', () => {
    const code = `
<script>
export default {
  props: { title: String }
}
</script>
<template><div /></template>`
    expect(extractPropNamesFromVue(code)).toEqual([])
  })

  it('returns empty for components without defineProps', () => {
    const code = `
<script setup lang="ts">
const msg = 'hello'
</script>
<template><div /></template>`
    expect(extractPropNamesFromVue(code)).toEqual([])
  })

  it('returns empty for invalid withDefaults + runtime object (Vue compiler rejects this)', () => {
    const code = `
<script setup>
withDefaults(defineProps({
  title: String,
  color: String,
}), {
  title: 'Default',
  color: 'blue',
})
</script>
<template><div /></template>`
    // withDefaults only works with type-based defineProps; compiler throws
    expect(extractPropNamesFromVue(code)).toEqual([])
  })
})
