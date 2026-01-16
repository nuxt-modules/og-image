<script setup lang="ts">
/**
 * Ejected NuxtSeo template for testing
 */

import { computed } from 'vue'

const props = withDefaults(defineProps<{
  colorMode?: 'dark' | 'light'
  title?: string
  description?: string
  isPro?: boolean
}>(), {
  colorMode: 'light',
  title: 'title',
})

const themeColor = computed(() => props.isPro ? '124, 58, 237' : '34, 197, 94')
</script>

<template>
  <div
    class="w-full h-full flex flex-col justify-center items-center relative p-[60px]"
    :class="[
      colorMode === 'light' ? ['bg-white', 'text-neutral-900'] : ['bg-neutral-900', 'text-neutral-50'],
    ]"
  >
    <!-- Gradient background -->
    <div
      class="absolute inset-0" :style="{
        backgroundImage: `radial-gradient(ellipse at bottom right, rgba(${themeColor}, 0.15) 0%, transparent 60%)`,
      }"
    />
    <div
      class="absolute inset-0" :style="{
        backgroundImage: `radial-gradient(ellipse at top left, rgba(${themeColor}, 0.1) 0%, transparent 50%)`,
      }"
    />

    <div class="relative flex flex-col items-center text-center gap-8">
      <!-- Logo -->
      <div class="flex items-center gap-3">
        <svg viewBox="0 0 64 64" class="w-16 h-16">
          <defs>
            <linearGradient :id="isPro ? 'nsLine2' : 'nsLine1'" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" :stop-color="isPro ? '#7c3aed' : '#22c55e'" />
              <stop offset="100%" :stop-color="isPro ? '#c4b5fd' : '#86efac'" />
            </linearGradient>
            <linearGradient :id="isPro ? 'nsFill2' : 'nsFill1'" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" :stop-color="isPro ? '#7c3aed' : '#22c55e'" stop-opacity="0.6" />
              <stop offset="100%" :stop-color="isPro ? '#7c3aed' : '#22c55e'" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d="M8 52 Q20 48 24 36 T40 20 T56 12 L56 56 L8 56 Z" :fill="`url(#${isPro ? 'nsFill2' : 'nsFill1'})`" />
          <path d="M8 52 Q20 48 24 36 T40 20 T56 12" fill="none" :stroke="`url(#${isPro ? 'nsLine2' : 'nsLine1'})`" stroke-width="4" stroke-linecap="round" />
          <circle cx="56" cy="12" r="6" :fill="`url(#${isPro ? 'nsLine2' : 'nsLine1'})`" />
        </svg>
        <span class="text-[42px] font-bold tracking-tight">
          Nuxt<span :class="isPro ? 'text-violet-500' : 'text-green-500'" class="ml-2">SEO{{ isPro ? ' Pro' : '' }}</span>
        </span>
      </div>

      <!-- Title -->
      <h1 class="text-[80px] font-bold m-0 leading-tight max-w-[1000px]">
        {{ title }}
      </h1>

      <!-- Description -->
      <p v-if="description" class="text-[32px] opacity-70 max-w-[900px] leading-relaxed">
        {{ description }}
      </p>
    </div>
  </div>
</template>

<style>
:root {
  font-family: 'Hubot Sans';
}
</style>
