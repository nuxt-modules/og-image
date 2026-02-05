<script setup lang="ts">
/**
 * @credits Takumi <https://takumi.kane.tw/>
 */

withDefaults(defineProps<{
  title?: string
  author?: string
  date?: string
  category?: string
  avatar?: string
  backgroundImage?: string
}>(), {
  title: 'Blog Post Title',
  author: 'Author Name',
  date: 'Jan 1, 2025',
  category: 'Technology',
})
</script>

<template>
  <div
    class="w-full h-full flex flex-col p-[60px] justify-between"
    :style="{
      backgroundColor: '#111',
      color: 'white',
      backgroundImage: backgroundImage || 'linear-gradient(135deg, #1a1a1a 0%, #000 100%)',
    }"
  >
    <div class="flex items-start">
      <div
        class="text-[24px] font-semibold px-6 py-2"
        style="background-color: #3b82f6; border-radius: 9999px;"
      >
        {{ category }}
      </div>
    </div>

    <div class="flex flex-col gap-6">
      <h1
        class="text-[80px] font-extrabold m-0"
        style="line-height: 1.1; text-shadow: 0 4px 12px rgba(0,0,0,0.5);"
      >
        {{ title }}
      </h1>
    </div>

    <div class="flex items-center gap-6">
      <div
        v-if="avatar"
        class="overflow-hidden"
        style="width: 80px; height: 80px; border-radius: 50%; border: 4px solid rgba(255,255,255,0.1);"
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
        <span class="text-[24px]" style="color: #a1a1aa;">{{ date }}</span>
      </div>
    </div>
  </div>
</template>
