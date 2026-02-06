<script setup lang="ts">
/**
 * Neo-brutalist design with bold typography and raw aesthetics
 */

withDefaults(defineProps<{
  colorMode?: 'dark' | 'light'
  title?: string
  subtitle?: string
  accent?: string
}>(), {
  colorMode: 'light',
  title: 'title',
  accent: '#facc15',
})
</script>

<template>
  <div class="h-full w-full flex relative overflow-hidden bg-neutral-100 dark:bg-neutral-800">
    <!-- Offset shadow box -->
    <div
      class="absolute bg-black dark:bg-neutral-300"
      style="top: 28px; left: 28px; right: 52px; bottom: 52px;"
    />

    <!-- Main card -->
    <div class="absolute inset-10 p-12 border-4 flex flex-col justify-between bg-white border-black dark:bg-neutral-900 dark:border-neutral-300">
      <!-- Accent bar -->
      <div
        class="absolute w-32 hidden lg:flex"
        :style="{ background: accent, top: '0', right: '0', bottom: '-4px' }"
      />

      <!-- Corner marks -->
      <div class="absolute top-3 left-3 w-4 h-4 border-l-4 border-t-4 border-black dark:border-neutral-300" />
      <div class="absolute bottom-3 left-3 w-4 h-4 border-l-4 border-b-4 border-black dark:border-neutral-300" />

      <div class="relative max-w-[85%]">
        <p v-if="subtitle" class="text-lg font-mono uppercase tracking-[0.3em] text-neutral-500 mb-4" style="display: block; line-clamp: 1; text-overflow: ellipsis;">
          {{ subtitle }}
        </p>
        <h1
          class="text-[76px] font-bold leading-[0.95] tracking-tighter uppercase text-black dark:text-white"
          style="display: block; line-clamp: 3; text-overflow: ellipsis; text-wrap: balance;"
        >
          {{ title }}
        </h1>
      </div>

      <!-- Bottom marker -->
      <div class="flex items-center gap-4 relative">
        <div class="w-12 h-1 bg-black dark:bg-neutral-300" />
        <div class="w-3 h-3 rotate-45 bg-black dark:bg-neutral-300" />
      </div>
    </div>
  </div>
</template>
