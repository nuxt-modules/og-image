<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
}>(), {
  title: 'JetBrains Mono',
})
</script>

<template>
  <div class="h-full w-full flex flex-col justify-center items-center bg-zinc-900 font-mono">
    <h1 class="text-7xl font-bold text-emerald-400">
      {{ title }}
    </h1>
    <p class="text-2xl text-zinc-400 mt-4">
      Monospace code font
    </p>
  </div>
</template>
