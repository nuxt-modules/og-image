<script setup lang="ts">
withDefaults(defineProps<{
  colorMode?: 'dark' | 'light'
  title?: string
  description?: string
}>(), {
  colorMode: 'light',
  title: 'Blog Post',
  description: '',
})
</script>

<template>
  <div class="w-full h-full flex flex-col justify-between bg-white dark:bg-neutral-900 p-16">
    <!-- Badge -->
    <div class="flex">
      <div class="text-[20px] font-semibold px-5 py-2 bg-blue-500 text-white rounded-full">
        Blog
      </div>
    </div>

    <!-- Content -->
    <div class="flex flex-col gap-4">
      <h1 class="text-[64px] font-bold text-neutral-900 dark:text-white leading-tight">
        {{ title }}
      </h1>
      <p v-if="description" class="text-[28px] text-neutral-500 dark:text-neutral-400">
        {{ description }}
      </p>
    </div>

    <!-- Footer -->
    <div class="flex items-center gap-3">
      <div class="w-3 h-3 rounded-full bg-blue-500" />
      <span class="text-[22px] text-neutral-400">example.com</span>
    </div>
  </div>
</template>
