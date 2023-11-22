<script lang="ts" setup>
import { withQuery } from 'ufo'
import { computed } from '#imports'
import { absoluteBasePath, options, optionsOverrides, refreshSources, refreshTime } from '~/util/logic'

const height = options.value?.height || 630
const width = options.value?.width || 1200

const aspectRatio = width / height

const src = computed(() => {
  return withQuery(`${absoluteBasePath.value}/__og_image__/og.png`, { timestamp: refreshTime.value, ...optionsOverrides.value })
})
</script>

<template>
  <div class="flex h-full w-full">
    <ImageLoader
      :src="src"
      :aspect-ratio="aspectRatio"
      description="Generated PNG with Satori and ReSVG in %sms."
      class="max-h-full"
      @refresh="refreshSources"
    />
  </div>
</template>
