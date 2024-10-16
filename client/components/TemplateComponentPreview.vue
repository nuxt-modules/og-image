<script setup lang="ts">
import type { OgImageComponent } from '../../src/runtime/types'
import { withQuery } from 'ufo'
import { computed, ref } from 'vue'
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
  <div class="group">
    <div class="opacity-70 text-sm transition group-hover:opacity-100">
      <NLink :href="creditSite" external class="underline">
        {{ component.pascalName }}
      </NLink>
    </div>
    <div class="border-2 group-hover:shadow-sm rounded-[0.35rem] border-transparent hover:border-yellow-500 transition-all">
      <VTooltip>
        <div class="w-[300px] h-[150px] relative">
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
            class="pointer-events-none"
            :max-height="120"
            :aspect-ratio="aspectRatio"
            @load="e => loadStats = e"
          />
        </div>
        <template #popper>
          Preview {{ component.pascalName }} for the current page.
        </template>
      </VTooltip>
    </div>
    <div class="flex justify-between items-center text-xs px-2">
      <VTooltip>
        <div class="">
          <NLink external class="opacity-70 items-start space-x-1 flex" @click.stop="openComponent">
            <span class="underline">View source</span>
          </NLink>
        </div>
        <template #popper>
          Open the source code of {{ component.pascalName }}.vue in your IDE
        </template>
      </VTooltip>
      <div v-if="component.credits" class="opacity-70 transition group-hover:opacity-100">
        Credits:
        <NLink v-if="creditSite" :href="creditSite" external class="underline">
          {{ creditName }}
        </NLink>
      </div>
    </div>
  </div>
</template>
