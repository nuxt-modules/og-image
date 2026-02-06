<script setup lang="ts">
/**
 * @credits Takumi <https://takumi.kane.tw/>
 */

withDefaults(defineProps<{
  colorMode?: 'dark' | 'light'
  title?: string
  author?: string
  date?: string
  category?: string
  avatar?: string
  backgroundImage?: string
}>(), {
  colorMode: 'dark',
  title: 'Blog Post Title',
  author: 'Author Name',
  date: 'Jan 1, 2025',
  category: 'Technology',
})
</script>

<template>
  <div
    class="w-full h-full flex flex-col p-[60px] justify-between bg-neutral-50 text-neutral-900 dark:bg-neutral-900 dark:text-white"
    :style="backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined"
  >
    <div class="flex items-start">
      <div class="text-[24px] font-semibold px-6 py-2 text-white bg-blue-500 rounded-full">
        {{ category }}
      </div>
    </div>

    <div class="flex flex-col gap-6">
      <h1
        class="text-[80px] font-extrabold m-0"
        style="line-height: 1.1;"
      >
        {{ title }}
      </h1>
    </div>

    <div class="flex items-center gap-6">
      <div
        v-if="avatar"
        class="overflow-hidden border-4 border-neutral-200 dark:border-neutral-800"
        style="width: 80px; height: 80px; border-radius: 50%;"
      >
        <img
          :src="avatar"
          alt="Avatar"
          class="w-full h-full"
          style="object-fit: cover; border-radius: 50%;"
        >
      </div>
      <div class="flex flex-col">
        <span class="text-[32px] font-semibold">{{ author }}</span>
        <span class="text-[24px] text-neutral-400">{{ date }}</span>
      </div>
    </div>
  </div>
</template>
