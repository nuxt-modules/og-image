<script setup lang="ts">
/**
 * @credits Full Stack Heroes <https://fullstackheroes.com/>
 */

import { useSiteConfig } from '#site-config/app/composables'
import { parseURL } from 'ufo'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  colorMode?: 'dark' | 'light'
  title?: string
  website?: string
}>(), {
  colorMode: 'light',
  title: 'title',
})

// fallback to site name
const website = computed(() => {
  return props.website || parseURL(useSiteConfig().url).host
})
</script>

<template>
  <div class="h-full w-full flex relative overflow-hidden bg-neutral-50 dark:bg-neutral-900">
    <!-- Accent bar -->
    <div class="absolute left-0 top-0 bottom-0 w-3 bg-blue-500" />

    <!-- Subtle pattern -->
    <div class="absolute inset-0 opacity-[0.015]" :style="{ backgroundImage: 'radial-gradient(rgb(115 115 115) 1px, transparent 1px)', backgroundSize: '24px 24px' }" />

    <!-- Decorative circles -->
    <div class="absolute w-[300px] h-[300px] rounded-full opacity-[0.04] bg-blue-500" style="top: -100px; right: -50px;" />
    <div class="absolute w-[200px] h-[200px] rounded-full opacity-[0.03] bg-blue-500" style="bottom: -50px; right: 200px;" />

    <div class="flex flex-col justify-between w-full h-full pl-12 pr-16 py-14 relative">
      <h1
        class="text-[72px] font-bold text-neutral-800 dark:text-neutral-100 leading-[1.1] tracking-tight max-w-[90%]"
        style="display: block; line-clamp: 3; text-overflow: ellipsis; text-wrap: balance;"
      >
        {{ title }}
      </h1>
      <div class="flex items-center gap-3">
        <div class="w-3 h-3 rounded-full bg-blue-500" />
        <p class="text-[26px] font-bold text-neutral-500 dark:text-neutral-400" style="display: block; line-clamp: 1; text-overflow: ellipsis;">
          {{ website }}
        </p>
      </div>
    </div>
  </div>
</template>
