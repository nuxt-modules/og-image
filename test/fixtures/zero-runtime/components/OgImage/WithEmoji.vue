<script setup lang="ts">
/**
 * @credits Full Stack Heroes <https://fullstackheroes.com/>
 */

withDefaults(defineProps<{
  emoji?: string
  title?: string
}>(), {
  title: 'title',
  emoji: '👋',
})
</script>

<template>
  <div class="h-full w-full flex items-center justify-center relative overflow-hidden" style="background: linear-gradient(135deg, #fafbfc 0%, #f0f4f8 50%, #e8eef5 100%);">
    <!-- Subtle grid pattern -->
    <div class="absolute inset-0 opacity-[0.03]" style="background-image: linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px); background-size: 40px 40px;" />

    <!-- Soft glow behind emoji -->
    <div class="absolute w-[400px] h-[400px] rounded-full opacity-20" style="background: radial-gradient(circle, #38bdf8 0%, transparent 70%); top: 50%; left: 50%; transform: translate(-50%, -65%);" />

    <div class="flex flex-col justify-center items-center w-full text-center relative z-10 px-16">
      <div class="mb-6" style="filter: drop-shadow(0 8px 24px rgba(0,0,0,0.08));">
        <p class="text-[140px] leading-none">
          {{ emoji }}
        </p>
      </div>
      <h1 class="text-[58px] font-bold text-slate-800 leading-tight tracking-tight max-w-[900px]" style="display: block; line-clamp: 2; text-overflow: ellipsis; text-shadow: 0 1px 2px rgba(0,0,0,0.04);">
        {{ title }}
      </h1>
    </div>
  </div>
</template>
