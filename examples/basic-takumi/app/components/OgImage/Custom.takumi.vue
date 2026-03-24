<script setup lang="ts">
withDefaults(defineProps<{
  colorMode?: 'dark' | 'light'
  title?: string
  description?: string
}>(), {
  colorMode: 'light',
  title: 'My Page Title',
  description: 'My page description',
})
</script>

<template>
  <div class="w-full h-full flex flex-col justify-between bg-white dark:bg-neutral-900 p-16">
    <!-- Accent -->
    <div class="absolute left-0 top-0 bottom-0 w-2 bg-purple-500" />

    <!-- Content -->
    <div class="flex flex-col gap-4 pl-4">
      <h1 class="text-[64px] font-bold text-neutral-900 dark:text-white leading-tight">
        {{ title }}
      </h1>
      <p class="text-[28px] text-neutral-500 dark:text-neutral-400">
        {{ description }}
      </p>
    </div>

    <!-- Footer -->
    <div class="flex items-center gap-3 pl-4">
      <div class="w-3 h-3 rounded-full bg-purple-500" />
      <span class="text-[22px] text-neutral-400">example.com</span>
    </div>
  </div>
</template>
