<script setup lang="ts">
/**
 * @credits Full Stack Heroes <https://fullstackheroes.com/>
 */

import { useSiteConfig } from '#site-config/app/composables'
import { parseURL } from 'ufo'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title?: string
  website?: string
}>(), {
  title: 'title',
})

// fallback to site name
const website = computed(() => {
  return props.website || parseURL(useSiteConfig().url).host
})
</script>

<template>
  <div class="h-full w-full flex items-start justify-start border-solid border-blue-500 border-[12px] bg-gray-50">
    <div class="flex items-start justify-start h-full">
      <div class="flex flex-col justify-between w-full h-full">
        <h1 class="text-[80px] p-20 font-black text-left" style="display: block; line-clamp: 2; text-overflow: ellipsis;">
          {{ title }}
        </h1>
        <p class="text-2xl pb-10 px-20 font-bold mb-0" style="display: block; line-clamp: 3; text-overflow: ellipsis;">
          {{ website }}
        </p>
      </div>
    </div>
  </div>
</template>
