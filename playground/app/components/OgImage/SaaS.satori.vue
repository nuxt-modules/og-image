<script setup lang="ts">
/**
 * @credits Basecamp-inspired SaaS template
 */
import { useSiteConfig } from '#site-config/app/composables'

const props = withDefaults(defineProps<{
  title?: string
  icon?: string
  siteName?: string
  theme?: string
  image?: string
}>(), {
  theme: '#6366f1',
})

const siteConfig = useSiteConfig()

const title = props.title || siteConfig.title || 'Build something amazing'
const siteName = props.siteName || siteConfig.name || 'Acme'
</script>

<template>
  <div class="w-full h-full flex flex-col relative overflow-hidden" :style="{ background: theme }">
    <!-- Main content area - full height -->
    <div class="flex-1 flex flex-col p-7 relative">
      <!-- Left side: Title + Site name -->
      <div class="flex flex-col justify-between h-full w-full lg:w-[50%]">
        <!-- Title -->
        <h1
          class="font-bold leading-[1.08] tracking-tight text-white text-[56px] line-clamp-3 italic"
          style="display: block; text-shadow: 0 2px 10px rgba(0,0,0,0.2);"
        >
          {{ title }}
        </h1>

        <!-- Logo / Site name -->
        <div class="flex flex-row items-center gap-3">
          <div v-if="icon" class="flex items-center justify-center rounded-full bg-white/20 w-14 h-14">
            <span class="text-3xl text-white">{{ icon }}</span>
          </div>
          <span class="font-bold text-white text-[56px]">{{ siteName }}</span>
        </div>
      </div>

      <!-- Product screenshot - absolute positioned, cut off on right -->
      <div
        v-if="image"
        class="absolute flex flex-col bg-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl hidden lg:flex"
        style="right: -120px; top: 20px; bottom: 20px; width: 55%;"
      >
        <!-- Browser toolbar -->
        <div class="flex flex-row items-center bg-[#2d2d2d] px-4 py-3">
          <div class="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div class="w-3 h-3 rounded-full bg-[#febc2e] ml-2" />
          <div class="w-3 h-3 rounded-full bg-[#28c840] ml-2" />
        </div>
        <!-- Screenshot area -->
        <div class="flex-1 flex bg-[#f5f5f5]">
          <img
            :src="image"
            class="w-full h-full object-cover object-left-top"
          >
        </div>
      </div>
    </div>
  </div>
</template>
