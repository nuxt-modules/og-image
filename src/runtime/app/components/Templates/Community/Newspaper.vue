<script setup lang="ts">
/**
 * Editorial/newspaper magazine style with strong typography
 */

import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title?: string
  category?: string
  publication?: string
  date?: string
}>(), {
  title: 'title',
  publication: 'The Daily',
})

const formattedDate = computed(() => {
  if (props.date) return props.date
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})
</script>

<template>
  <div class="h-full w-full flex flex-col relative overflow-hidden" style="background: #faf9f7;">
    <!-- Paper texture -->
    <div class="absolute inset-0 opacity-[0.4]" style="background-image: url('data:image/svg+xml,%3Csvg viewBox=%270 0 200 200%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27noise%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23noise)%27/%3E%3C/svg%3E');" />

    <!-- Top rule -->
    <div class="w-full h-1 bg-black" />
    <div class="w-full h-[2px] bg-black mt-1" />

    <!-- Masthead -->
    <div class="px-12 pt-6 pb-4 border-b-2 border-black">
      <div class="flex items-end justify-between">
        <p class="text-sm leading-1.5 tracking-[0.2em] uppercase text-black/60">
          foo: {{ formattedDate }}
        </p>
        <h2 class="text-4xl leading-1 font-black tracking-tight text-black uppercase" style="font-style: italic; line-height: 20px;">
          {{ publication }}
        </h2>
        <p v-if="category" class="text-sm leading-1.5 tracking-[0.2em] uppercase text-black/60">
          {{ category }}
        </p>
      </div>
    </div>

    <!-- Thin decorative line -->
    <div class="w-full h-[1px] bg-black/20" />

    <!-- Main headline -->
    <div class="flex-1 flex items-center px-16 py-12">
      <h1
        class="text-[72px] font-black text-black leading-[1.05] tracking-tight text-center w-full"
        style="display: block; line-clamp: 3; text-overflow: ellipsis; font-variant-ligatures: discretionary-ligatures;"
      >
        {{ title }}
      </h1>
    </div>

    <!-- Bottom rules -->
    <div class="px-16 pb-12">
      <div class="flex items-center gap-6">
        <div class="flex-1 h-[1px] bg-black/30" />
        <div class="w-2 h-2 bg-black" style="transform: rotate(45deg);" />
        <div class="flex-1 h-[1px] bg-black/30" />
      </div>
    </div>

    <div class="w-full h-[2px] bg-black" />
    <div class="w-full h-1 bg-black mt-1" />
  </div>
</template>
