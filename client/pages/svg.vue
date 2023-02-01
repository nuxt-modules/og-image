<script lang="ts" setup>
import { host, path, refreshTime, rpc } from '~/util/logic'

const config = await rpc.useServerConfig()

const height = config.value?.height || 630
const width = config.value?.width || 1200

const aspectRatio = width / height
</script>

<template>
  <ImageLoader
    :src="`${host}/api/og-image-svg?path=${path}&timestamp=${refreshTime}`"
    :aspect-ratio="aspectRatio"
    description="[SVG] Generated in %sms using Satori."
  />
</template>
