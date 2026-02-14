<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <div data-theme="dark" data-bg-theme="slate" class="w-full h-full flex items-center justify-center bg-bg text-fg">
    <div class="flex flex-col items-center gap-4">
      <h1 class="text-4xl font-bold">
        {{ title || 'Dark Themed' }}
      </h1>
      <p class="text-xl text-fg-muted">
        data-theme=dark + data-bg-theme=slate
      </p>
      <div class="bg-bg-subtle text-theme-accent px-4 py-2 rounded-lg">
        accent badge
      </div>
    </div>
  </div>
</template>
