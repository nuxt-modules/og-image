<script lang="ts" setup>
/**
 * @credits Pergel <https://nuxtlabs.com/>
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{ colorMode?: 'dark' | 'light', title?: string, description?: string, headline?: string }>(), {
  colorMode: 'dark',
  title: 'title',
  description: 'description',
  headline: 'headline',
})

const title = computed(() => props.title.slice(0, 60))
</script>

<template>
  <div class="w-full h-full flex flex-col justify-center relative overflow-hidden bg-neutral-50 dark:bg-neutral-900">
    <!-- Subtle noise texture -->
    <div class="absolute inset-0 opacity-[0.03]" style="background-image: url('data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27noise%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.8%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23noise)%27/%3E%3C/svg%3E');" />

    <svg class="absolute top-0 right-0" width="1200" height="675" viewBox="0 0 1200 675" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g style="mix-blend-mode:overlay" opacity="0.6" filter="url(#filter0_f_448_25)">
        <circle cx="950" cy="30" r="220" fill="#FF9B9B" />
        <circle cx="620" cy="200" r="200" fill="#FFD166" />
        <circle cx="200" cy="340" r="180" fill="#FF9F43" />
      </g>
      <defs>
        <filter id="filter0_f_448_25" x="-240" y="-374" width="1561" height="1111" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="120" result="effect1_foregroundBlur_448_25" />
        </filter>
      </defs>
    </svg>

    <div class="max-w-[1000px] pl-6 lg:pl-[80px]">
      <p v-if="headline" class="uppercase text-[22px] text-amber-400 mb-3 font-bold tracking-wider">
        {{ headline }}
      </p>
      <h1 class="m-0 text-[68px] font-bold mb-5 text-neutral-900 dark:text-white leading-[1.1] tracking-tight">
        {{ title }}
      </h1>
      <p v-if="description" class="text-[30px] text-neutral-600 dark:text-neutral-400 leading-[1.4]">
        {{ description }}
      </p>
    </div>
  </div>
</template>
