<script lang="ts" setup>
import { absoluteBasePath, refreshTime, rpc } from '~/util/logic'

const config = await rpc.useServerConfig()

const height = config.value?.height || 630
const width = config.value?.width || 1200

const aspectRatio = width / height

const options = await fetchOptions()
</script>

<template>
  <ImageLoader
    :src="`${absoluteBasePath}/__og_image__/svg?timestamp=${refreshTime}`"
    :aspect-ratio="aspectRatio"
    description="[SVG] Generated in %sms using Satori."
  />
</template>
