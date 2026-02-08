<script setup lang="ts">
import type { OgImageComponent } from '../../src/runtime/types'
import { withQuery } from 'ufo'
import { computed, ref } from 'vue'
import { devtoolsClient } from '../composables/rpc'

const props = defineProps<{
  src: string
  aspectRatio: number
  component: OgImageComponent
  active: boolean
  imageFormat?: string
  width?: string
  height?: string
}>()

function openComponent() {
  devtoolsClient.value?.devtools.rpc.openInEditor(props.component.path!)
}

const isHtml = computed(() => {
  return props.src.includes('.html')
})

const creditName = computed(() => {
  return props.component.credits?.split('<')[0]?.trim()
})
const creditSite = computed(() => {
  return props.component.credits?.split('<')[1]?.trim().replace(/>/g, '')
})

const loadStats = ref<{ timeTaken: string, sizeKb: string }>()
</script>

<template>
  <div class="template-card group">
    <div class="template-header">
      <ULink :to="creditSite" target="_blank" class="template-name">
        {{ component.pascalName }}
      </ULink>
    </div>
    <div class="template-preview" :class="active ? 'is-active' : ''">
      <UTooltip :text="`Preview ${component.pascalName} for the current page.`">
        <div class="template-image" :style="{ aspectRatio }">
          <UIcon v-if="active" name="carbon:checkmark-filled" class="active-badge" />
          <ImageLoader
            v-if="!isHtml"
            :src="withQuery(src, { component: component.pascalName })"
            :aspect-ratio="aspectRatio"
            class="w-full h-full"
            @load="(e: { timeTaken: string, sizeKb: string }) => loadStats = e"
          />
          <IFrameLoader
            v-else
            :src="src"
            class="pointer-events-none"
            :aspect-ratio="aspectRatio"
            @load="(e: { timeTaken: string, sizeKb: string }) => loadStats = e"
          />
        </div>
      </UTooltip>
    </div>
    <div class="template-footer">
      <UTooltip :text="`Open the source code of ${component.pascalName}.vue in your IDE`">
        <ULink class="template-action" @click.stop="openComponent">
          <UIcon name="carbon:code" class="w-3 h-3" />
          View source
        </ULink>
      </UTooltip>
      <div v-if="component.credits" class="template-credit">
        <ULink v-if="creditSite" :to="creditSite" target="_blank">
          {{ creditName }}
        </ULink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.template-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.template-header {
  padding: 0 8px;
}

.template-name {
  font-size: 13px;
  font-weight: 500;
  color: oklch(55% 0.04 285);
  transition: color 0.15s ease;
  text-decoration: none;
}

.group:hover .template-name {
  color: oklch(35% 0.04 285);
}

.dark .template-name {
  color: oklch(70% 0.03 285);
}

.dark .group:hover .template-name {
  color: oklch(90% 0.02 285);
}

.template-preview {
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  background: oklch(98% 0.005 285);
}

.dark .template-preview {
  background: oklch(18% 0.04 285);
}

.template-preview:hover {
  border-color: var(--seo-green);
  box-shadow: 0 4px 16px oklch(0% 0 0 / 0.08);
}

.template-preview.is-active {
  border-color: var(--seo-green);
  box-shadow: 0 0 0 3px oklch(75% 0.15 145 / 0.2);
}

.template-image {
  position: relative;
  height: 150px;
  overflow: hidden;
}

.active-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  color: var(--seo-green);
  z-index: 1;
  filter: drop-shadow(0 1px 2px oklch(0% 0 0 / 0.2));
}

.template-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8px;
  font-size: 11px;
}

.template-action {
  display: flex;
  align-items: center;
  gap: 4px;
  color: oklch(55% 0.04 285);
  transition: color 0.15s ease;
  cursor: pointer;
}

.template-action:hover {
  color: var(--seo-green);
}

.dark .template-action {
  color: oklch(60% 0.03 285);
}

.template-credit {
  color: oklch(60% 0.04 285);
}

.template-credit a {
  color: inherit;
  text-decoration: none;
}

.template-credit a:hover {
  text-decoration: underline;
}
</style>
