<script setup lang="ts">
/**
 * @credits Full Stack Heroes <https://fullstackheroes.com/>
 */

withDefaults(defineProps<{
  colorMode?: 'dark' | 'light'
  emoji?: string
  title?: string
}>(), {
  colorMode: 'light',
  title: 'title',
  emoji: '👋',
})
</script>

<template>
  <div class="h-full w-full flex items-center justify-center relative overflow-hidden bg-neutral-50 dark:bg-neutral-900">
    <!-- Subtle grid pattern -->
    <div class="absolute inset-0 opacity-10" :style="{ backgroundImage: 'linear-gradient(rgb(163 163 163) 1px, transparent 1px), linear-gradient(90deg, rgb(163 163 163) 1px, transparent 1px)', backgroundSize: '40px 40px' }" />

    <!-- Soft glow behind emoji -->
    <div class="absolute w-[400px] h-[400px] rounded-full opacity-20" style="background: radial-gradient(circle, #38bdf8 0%, transparent 70%); top: 50%; left: 50%; transform: translate(-50%, -65%);" />

    <div class="flex flex-col justify-center items-center w-full text-center relative px-16">
      <div class="mb-6" style="filter: drop-shadow(0 8px 24px rgba(0,0,0,0.08));">
        <p class="text-[140px] leading-none">
          {{ emoji }}
        </p>
      </div>
      <h1
        class="text-[58px] font-bold text-neutral-800 dark:text-neutral-100 leading-tight tracking-tight max-w-[900px]"
        style="display: block; line-clamp: 2; text-overflow: ellipsis; text-wrap: balance;"
      >
        {{ title }}
      </h1>
    </div>
  </div>
</template>
