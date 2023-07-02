<script lang="ts" setup>
import { host, options, path, refreshSources, refreshTime } from '~/util/logic'

const height = options.value?.height || 630
const width = options.value?.width || 1200

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
