<script setup lang="ts">
withDefaults(defineProps<{ code?: string }>(), { code: 'GR8F' })
</script>

<template>
  <div class="h-full w-full flex items-center justify-between bg-black px-24">
    <div class="flex flex-col">
      <p class="text-3xl text-neutral-400">
        You're invited
      </p>
      <p class="text-9xl font-bold text-white tracking-widest">
        {{ code }}
      </p>
    </div>
    <div class="flex items-center justify-center w-80 h-80">
      <div class="w-56 h-56 rounded-3xl bg-amber-400 animate-spin" />
      <div class="absolute w-40 h-40 rounded-full bg-amber-200 animate-ping" />
    </div>
  </div>
</template>
