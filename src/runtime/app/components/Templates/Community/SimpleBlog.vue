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
  <div class="h-full w-full flex relative overflow-hidden" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);">
    <!-- Accent bar -->
    <div class="absolute left-0 top-0 bottom-0 w-3" style="background: linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%);" />

    <!-- Subtle pattern -->
    <div class="absolute inset-0 opacity-[0.015]" style="background-image: radial-gradient(#64748b 1px, transparent 1px); background-size: 24px 24px;" />

    <!-- Decorative circles -->
    <div class="absolute w-[300px] h-[300px] rounded-full opacity-[0.04]" style="background: #3b82f6; top: -100px; right: -50px;" />
    <div class="absolute w-[200px] h-[200px] rounded-full opacity-[0.03]" style="background: #3b82f6; bottom: -50px; right: 200px;" />

    <div class="flex flex-col justify-between w-full h-full pl-12 pr-16 py-14 relative z-10">
      <h1 class="text-[72px] font-bold text-slate-800 leading-[1.1] tracking-tight max-w-[950px]" style="display: block; line-clamp: 2; text-overflow: ellipsis;">
        {{ title }}
      </h1>
      <div class="flex items-center gap-3">
        <div class="w-3 h-3 rounded-full bg-blue-500" />
        <p class="text-[26px] font-semibold text-slate-500" style="display: block; line-clamp: 1; text-overflow: ellipsis;">
          {{ website }}
        </p>
      </div>
    </div>
  </div>
</template>
