<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <div data-theme="dark" data-bg-theme="zinc" class="w-full h-full flex items-center justify-center bg-bg text-fg">
    <div class="flex flex-col items-center gap-4">
      <h1 class="flex flex-wrap gap-[0.2em] my-[21.44px] text-4xl font-bold">
        {{ title || 'Dark Zinc' }}
      </h1>
      <p class="flex flex-wrap gap-[0.2em] my-4 text-xl text-fg-muted">
        data-theme=dark + data-bg-theme=zinc
      </p>
      <div class="flex flex-col bg-bg-subtle text-theme-accent px-4 py-2 rounded-lg">
        accent badge
      </div>
    </div>
  </div>
</template>
