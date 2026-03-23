<script lang="ts" setup>
import { useOgImage } from '../composables/og-image'

const {
  globalDebug,
  debug,
} = useOgImage()
</script>

<template>
  <div class="h-full max-h-full overflow-hidden space-y-5">
    <DevtoolsSection v-if="debug?.warnings?.length" icon="carbon:warning" text="Satori Warnings">
      <div class="space-y-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
        <div v-for="(warning, i) in debug.warnings" :key="i" class="text-sm text-amber-200 font-mono">
          {{ warning }}
        </div>
      </div>
    </DevtoolsSection>
    <DevtoolsSection icon="carbon:settings" text="Compatibility">
      <DevtoolsSnippet :code="JSON.stringify(globalDebug?.compatibility || {}, null, 2)" lang="json" label="Compatibility" />
    </DevtoolsSection>
    <DevtoolsSection icon="carbon:ibm-cloud-pak-manta-automated-data-lineage" text="vNodes">
      <DevtoolsSnippet :code="JSON.stringify(debug?.vnodes || {}, null, 2)" lang="json" label="vNodes" />
    </DevtoolsSection>
    <DevtoolsSection icon="carbon:ibm-cloud-pak-manta-automated-data-lineage" text="SVG">
      <DevtoolsSnippet :code="debug?.svg?.replaceAll('>', '>\n') || ''" lang="xml" label="SVG" />
    </DevtoolsSection>
    <DevtoolsSection icon="carbon:settings" text="Runtime Config">
      <DevtoolsSnippet :code="JSON.stringify(globalDebug?.runtimeConfig || {}, null, 2)" lang="json" label="Runtime Config" />
    </DevtoolsSection>
  </div>
</template>
