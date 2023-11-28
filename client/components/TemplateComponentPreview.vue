<script setup lang="ts">
import { withQuery } from 'ufo'
import { computed, ref } from 'vue'
import type { OgImageComponent } from '../../src/runtime/types'
import { devtoolsClient } from '~/composables/rpc'

const props = defineProps<{
  src: string
  aspectRatio: number
  component: OgImageComponent
  active: boolean
  imageFormat: string
}>()

function openComponent() {
  devtoolsClient.value?.devtools.rpc.openInEditor(props.component.path!)
}

const isHtml = computed(() => {
  return props.src.includes('.html')
})

const creditName = computed(() => {
  return props.component.credits?.split('<')[0].trim()
})
const creditSite = computed(() => {
  return props.component.credits?.split('<')[1].trim().replace('>', '')
})

const loadStats = ref<{ timeTaken: string, sizeKb: string }>()
</script>

<template>
  <div>
    <div v-if="component.credits" class="opacity-70 text-sm">
      <NLink v-if="creditSite" :href="creditSite" external class="underline">
        {{ creditName }}
      </NLink>
    </div>
    <div class="w-[228px] h-[120px] relative mb-1">
      <NIcon v-if="active" icon="carbon:checkmark-filled" class="absolute top-2 right-2 text-green-500" />
      <ImageLoader
        v-if="!isHtml"
        :src="withQuery(src, { component: component.pascalName })"
        :aspect-ratio="aspectRatio"
        class="rounded overflow-hidden"
        :class="active ? ['ring-2 ring-green-500'] : []"
        @load="e => loadStats = e"
      />
      <IFrameLoader
        v-else
        :src="src"
        :aspect-ratio="aspectRatio"
        @load="e => loadStats = e"
      />
    </div>
    <div class="flex justify-between items-center text-xs px-2">
      <div class="flex items-center">
        <NLink external class="underline opacity-85" @click.stop="openComponent">
          {{ component.pascalName }}.vue
        </NLink>
      </div>
      <template v-if="loadStats">
        <div class="opacity-85">
          {{ loadStats.timeTaken }}ms
        </div>
        <div class="opacity-70">
          {{ loadStats.sizeKb }}kb
        </div>
      </template>
    </div>
  </div>
</template>
