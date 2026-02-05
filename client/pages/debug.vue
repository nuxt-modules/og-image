<script lang="ts" setup>
import { useOgImage } from '../composables/og-image'

const {
  globalDebug,
  debug,
} = useOgImage()
</script>

<template>
  <div class="h-full max-h-full overflow-hidden space-y-5">
    <OSectionBlock v-if="debug?.warnings?.length">
      <template #text>
        <h3 class="opacity-80 text-base mb-1 text-amber-500">
          <UIcon name="carbon:warning" class="mr-1" />
          Satori Warnings ({{ debug.warnings.length }})
        </h3>
      </template>
      <div class="space-y-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
        <div v-for="(warning, i) in debug.warnings" :key="i" class="text-sm text-amber-200 font-mono">
          {{ warning }}
        </div>
      </div>
    </OSectionBlock>
    <OSectionBlock>
      <template #text>
        <h3 class="opacity-80 text-base mb-1">
          <UIcon name="carbon:settings" class="mr-1" />
          Compatibility
        </h3>
      </template>
      <OCodeBlock :code="JSON.stringify(globalDebug?.compatibility || {}, null, 2)" lang="json" />
    </OSectionBlock>
    <OSectionBlock>
      <template #text>
        <h3 class="opacity-80 text-base mb-1">
          <UIcon name="carbon:ibm-cloud-pak-manta-automated-data-lineage" class="mr-1" />
          vNodes
        </h3>
      </template>
      <OCodeBlock :code="JSON.stringify(debug?.vnodes || {}, null, 2)" lang="json" />
    </OSectionBlock>
    <OSectionBlock>
      <template #text>
        <h3 class="opacity-80 text-base mb-1">
          <UIcon name="carbon:ibm-cloud-pak-manta-automated-data-lineage" class="mr-1" />
          SVG
        </h3>
      </template>
      <OCodeBlock :code="debug?.svg?.replaceAll('>', '>\n') || ''" lang="xml" />
    </OSectionBlock>
    <OSectionBlock>
      <template #text>
        <h3 class="opacity-80 text-base mb-1">
          <UIcon name="carbon:settings" class="mr-1" />
          Runtime Config
        </h3>
      </template>
      <OCodeBlock :code="JSON.stringify(globalDebug?.runtimeConfig || {}, null, 2)" lang="json" />
    </OSectionBlock>
  </div>
</template>
