<script lang="ts" setup>
import { withQuery } from 'ufo'
import { host, options, optionsOverrides, path, refreshSources, refreshTime } from '~/util/logic'
import { computed } from '#imports'

const height = options.value?.height || 630
const width = options.value?.width || 1200

const aspectRatio = width / height

const src = computed(() => {
  return withQuery(`${host.value}/api/og-image-html`, { path: path.value, timestamp: refreshTime.value, ...optionsOverrides.value })
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
