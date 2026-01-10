<script setup lang="ts">
/**
 * Neo-brutalist design with bold typography and raw aesthetics
 */

withDefaults(defineProps<{
  title?: string
  subtitle?: string
  accent?: string
}>(), {
  title: 'title',
  accent: '#facc15',
})
</script>

<template>
  <div class="h-full w-full flex relative overflow-hidden bg-stone-100">
    <!-- Offset shadow box -->
    <div
      class="absolute bg-black"
      style="top: 28px; left: 28px; right: 52px; bottom: 52px;"
    />

    <!-- Main card -->
    <div
      class="absolute bg-white border-4 border-black flex flex-col justify-between"
      style="top: 40px; left: 40px; right: 40px; bottom: 40px; padding: 48px;"
    >
      <!-- Accent bar -->
      <div
        class="absolute w-32"
        :style="{ background: accent, top: '-2px', right: '-4px', bottom: '-4px' }"
      />

      <!-- Corner marks -->
      <div class="absolute top-3 left-3 w-4 h-4 border-l-4 border-t-4 border-black" />
      <div class="absolute bottom-3 left-3 w-4 h-4 border-l-4 border-b-4 border-black" />

      <div class="relative z-10 max-w-[85%]">
        <p v-if="subtitle" class="text-lg font-mono uppercase tracking-[0.3em] text-black/60 mb-4">
          {{ subtitle }}
        </p>
        <h1
          class="text-[76px] font-black text-black leading-[0.95] tracking-tighter uppercase"
          style="display: block; line-clamp: 3; text-overflow: ellipsis;"
        >
          {{ title }}
        </h1>
      </div>

      <!-- Bottom marker -->
      <div class="flex items-center gap-4 relative z-10">
        <div class="w-12 h-1 bg-black" />
        <div class="w-3 h-3 bg-black" style="transform: rotate(45deg);" />
      </div>
    </div>
  </div>
</template>
