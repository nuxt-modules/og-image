<script lang="ts" setup>
import { withQuery } from 'ufo'
import { computed } from '#imports'
import { host, options, optionsOverrides, path, refreshTime } from '~/util/logic'

const height = options.value?.height || 630
const width = options.value?.width || 1200

const aspectRatio = width / height

const src = computed(() => {
  return withQuery(`${host.value}/api/og-image-svg`, { path: path.value, timestamp: refreshTime.value, ...optionsOverrides.value })
})
</script>

<template>
  <ImageLoader
    :src="src"
    :aspect-ratio="aspectRatio"
    description="[SVG] Generated in %sms using Satori."
  />
</template>
