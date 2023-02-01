<script lang="ts" setup>
import { host, path, refreshSources, refreshTime, rpc } from '~/util/logic'

const config = await rpc.useServerConfig()

const height = config.value?.height || 630
const width = config.value?.width || 1200

const aspectRatio = width / height
</script>

<template>
  <div class="flex h-full w-full">
    <IFrameLoader
      :src="`${host}/api/og-image-html?path=${path}&timestamp=${refreshTime}`"
      :aspect-ratio="aspectRatio"
      description="[HTML] Generated in %sms."
      class="max-h-full"
      @refresh="refreshSources"
    />
  </div>
</template>
