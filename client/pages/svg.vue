<script lang="ts" setup>
import { host, options, path, refreshTime } from '~/util/logic'

const height = options.value?.height || 630
const width = options.value?.width || 1200

const aspectRatio = width / height
</script>

<template>
  <ImageLoader
    :src="`${host}/api/og-image-svg?path=${path}&timestamp=${refreshTime}`"
    :aspect-ratio="aspectRatio"
    description="[SVG] Generated in %sms using Satori."
  />
</template>
