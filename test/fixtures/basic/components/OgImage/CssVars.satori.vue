<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
}>(), {
  title: 'CSS Vars Test',
})
</script>

<template>
  <div class="w-full h-full flex items-center justify-center" :style="{ backgroundColor: 'var(--brand-bg)', color: 'var(--brand-color)' }" style="--brand-color: #00dc82; --brand-bg: #1a1a2e;">
    <div class="flex flex-col items-center gap-4 p-8">
      <h1 class="text-6xl font-bold">
        {{ title }}
      </h1>
      <p :style="{ borderColor: 'var(--brand-color)', borderWidth: '2px', borderStyle: 'solid', padding: '8px 16px' }">
        CSS var() references
      </p>
    </div>
  </div>
</template>
