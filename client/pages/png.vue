<script lang="ts" setup>
import { absoluteBasePath, options, refreshTime } from '~/util/logic'

const height = options.value?.height || 630
const width = options.value?.width || 1200

const aspectRatio = width / height
</script>

<template>
  <ImageLoader
    :src="`${absoluteBasePath}/__og_image__/og.png?timestamp=${refreshTime}`"
    :aspect-ratio="aspectRatio"
    description="[PNG] Generated in %sms using Satori & Resvg."
  />
</template>
