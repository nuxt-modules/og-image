<script setup lang="ts">
/**
 * Glassmorphism with northern lights aurora effect
 */

withDefaults(defineProps<{
  title?: string
  description?: string
  logo?: string
}>(), {
  title: 'title',
})
</script>

<template>
  <div class="h-full w-full flex items-center justify-center relative overflow-hidden" style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);">
    <!-- Aurora blobs -->
    <div class="absolute w-[800px] h-[800px] rounded-full opacity-40" style="background: radial-gradient(circle, #06b6d4 0%, transparent 50%); top: -400px; left: -200px; filter: blur(80px);" />
    <div class="absolute w-[600px] h-[600px] rounded-full opacity-30" style="background: radial-gradient(circle, #8b5cf6 0%, transparent 50%); top: -100px; right: -100px; filter: blur(60px);" />
    <div class="absolute w-[500px] h-[500px] rounded-full opacity-35" style="background: radial-gradient(circle, #ec4899 0%, transparent 50%); bottom: -200px; left: 30%; filter: blur(70px);" />
    <div class="absolute w-[400px] h-[400px] rounded-full opacity-25" style="background: radial-gradient(circle, #10b981 0%, transparent 50%); bottom: -100px; right: 10%; filter: blur(50px);" />

    <!-- Stars -->
    <div class="absolute inset-0" style="background-image: radial-gradient(2px 2px at 20px 30px, white, transparent), radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 90px 40px, white, transparent), radial-gradient(2px 2px at 160px 120px, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 230px 80px, white, transparent), radial-gradient(2px 2px at 300px 150px, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 400px 60px, white, transparent), radial-gradient(2px 2px at 500px 180px, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 600px 90px, white, transparent), radial-gradient(2px 2px at 700px 130px, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 800px 50px, white, transparent), radial-gradient(2px 2px at 900px 170px, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 1000px 100px, white, transparent), radial-gradient(2px 2px at 1100px 140px, rgba(255,255,255,0.8), transparent); background-size: 1200px 630px; opacity: 0.6;" />

    <!-- Frosted glass card -->
    <div
      class="relative z-10 mx-16 p-12 rounded-3xl border border-white/20"
      style="background: rgba(255,255,255,0.08); backdrop-filter: blur(20px); box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1); max-width: calc(100% - 128px);"
    >
      <div class="flex items-center justify-between gap-8">
        <div style="flex: 1; min-width: 0;">
          <h1
            class="text-[64px] font-bold text-white leading-[1.1] tracking-tight mb-4"
            style="display: block; line-clamp: 2; text-overflow: ellipsis; text-shadow: 0 2px 20px rgba(0,0,0,0.3);"
          >
            {{ title }}
          </h1>
          <p
            v-if="description"
            class="text-[28px] text-white/70 leading-relaxed"
            style="display: block; line-clamp: 2; text-overflow: ellipsis;"
          >
            {{ description }}
          </p>
        </div>
        <img
          v-if="logo"
          :src="logo"
          class="w-20 h-20 rounded-2xl"
          style="filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3)); flex-shrink: 0;"
        >
      </div>
    </div>
  </div>
</template>
