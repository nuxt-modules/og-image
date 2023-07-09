<script lang="ts" setup>
import { withQuery } from 'ufo'
import { computed } from '#imports'
import { host, options, optionsOverrides, path, refreshSources, refreshTime } from '~/util/logic'

const height = options.value?.height || 630
const width = options.value?.width || 1200

const aspectRatio = width / height

const src = computed(() => {
  return withQuery(`${host.value}/api/og-image-html`, { options: optionsOverrides.value, path: path.value, timestamp: refreshTime.value })
})
</script>

<template>
  <div class="flex h-full w-full">
    <IFrameLoader
      :src="src"
      :aspect-ratio="aspectRatio"
      description="[HTML] Generated in %sms."
      class="max-h-full"
      @refresh="refreshSources"
    />
  </div>
</template>
