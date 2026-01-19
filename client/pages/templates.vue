<script lang="ts" setup>
import { navigateTo } from '#imports'
import { withQuery } from 'ufo'
import { useOgImage } from '../composables/og-image'

const {
  appComponents,
  communityComponents,
  activeComponentName,
  src,
  aspectRatio,
  isLoading,
  patchOptions,
} = useOgImage()

function selectTemplate(componentName: string) {
  patchOptions({ component: componentName })
  navigateTo('/')
}
</script>

<template>
  <div class="h-full max-h-full overflow-hidden space-y-5">
    <NLoading v-if="isLoading" />
    <div v-else class="space-y-5">
      <OSectionBlock v-if="appComponents.length">
        <template #text>
          <h3 class="opacity-80 text-base mb-1">
            <NIcon name="carbon:app" class="mr-1" />
            Your Templates
          </h3>
        </template>
        <div class="flex flex-wrap items-center justify-center gap-3" style="-webkit-overflow-scrolling: touch; -ms-overflow-style: -ms-autohiding-scrollbar;">
          <button v-for="name in appComponents" :key="name.pascalName" class="!p-0" @click="selectTemplate(name.pascalName)">
            <TemplateComponentPreview
              :component="name"
              :src="withQuery(src, { component: name.pascalName })"
              :aspect-ratio="aspectRatio"
              :active="name.pascalName === activeComponentName"
            />
          </button>
        </div>
      </OSectionBlock>
      <OSectionBlock>
        <template #text>
          <h3 class="opacity-80 text-base mb-1">
            <NIcon name="carbon:airline-passenger-care" class="mr-1" />
            Community Templates
          </h3>
        </template>
        <div class="flex flex-wrap items-center justify-center gap-3" style="-webkit-overflow-scrolling: touch; -ms-overflow-style: -ms-autohiding-scrollbar;">
          <button v-for="name in communityComponents" :key="name.pascalName" class="!p-0" @click="selectTemplate(name.pascalName)">
            <TemplateComponentPreview
              :component="name"
              :src="withQuery(src, { component: name.pascalName })"
              :aspect-ratio="aspectRatio"
              :active="name.pascalName === activeComponentName"
            />
          </button>
        </div>
      </OSectionBlock>
    </div>
  </div>
</template>
