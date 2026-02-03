<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <div class="w-full h-full flex bg-surface p-4">
    <!-- Left: Title panel with gradient -->
    <div class="w-48 rounded-xl mr-4 p-4 flex flex-col justify-center" style="background: linear-gradient(to bottom, #f29101, #8b5cf6)">
      <h1 class="text-2xl font-bold text-white">
        UnoCSS
      </h1>
      <p class="text-white/80 text-sm mt-1">
        {{ title || 'Test' }}
      </p>
    </div>

    <!-- Right: Color swatches and features -->
    <div class="flex-1 flex flex-wrap content-start gap-2 text-sm">
      <!-- Theme colors -->
      <div class="bg-primary-500 text-white px-3 py-1 rounded-lg">
        primary
      </div>
      <div class="bg-brand text-white px-3 py-1 rounded-lg">
        brand
      </div>
      <div class="bg-accent text-white px-3 py-1 rounded-lg">
        accent
      </div>
      <div class="bg-highlight text-white px-3 py-1 rounded-lg">
        highlight
      </div>
      <div class="bg-ocean text-white px-3 py-1 rounded-lg">
        ocean
      </div>
      <div class="bg-forest text-white px-3 py-1 rounded-lg">
        forest
      </div>
      <div class="bg-sunset text-white px-3 py-1 rounded-lg">
        sunset
      </div>

      <!-- Text colors -->
      <div class="text-brand font-bold px-3 py-1">
        text-brand
      </div>
      <div class="text-accent font-bold px-3 py-1">
        text-accent
      </div>
      <div class="text-highlight font-bold px-3 py-1">
        text-highlight
      </div>

      <!-- Borders -->
      <div class="border-2 border-brand text-brand px-3 py-1 rounded-lg">
        border
      </div>
      <div class="border-2 border-accent text-accent px-3 py-1 rounded-lg">
        border
      </div>

      <!-- Gradients (using hex colors directly for UnoCSS gradient utilities) -->
      <div class="text-white rounded-lg w-36 h-16 flex items-center justify-center font-bold" style="background: linear-gradient(to right, #f29101, #8b5cf6)">
        linear
      </div>
      <div class="text-white rounded-lg w-36 h-16 flex items-center justify-center font-bold" style="background: linear-gradient(to bottom, #0ea5e9, #22c55e)">
        vertical
      </div>
      <div class="text-white rounded-lg w-36 h-16 flex items-center justify-center font-bold" style="background: linear-gradient(to bottom right, #ec4899, #f97316)">
        diagonal
      </div>

      <!-- Filter demo boxes -->
      <div class="flex gap-2 mt-2">
        <div class="flex flex-col items-center justify-center bg-brand rounded-xl w-24 h-24">
          <span class="text-white text-xs">normal</span>
        </div>
        <div class="flex flex-col items-center justify-center bg-brand rounded-xl w-24 h-24" style="filter: brightness(1.5)">
          <span class="text-white text-xs">bright</span>
        </div>
        <div class="flex flex-col items-center justify-center bg-brand rounded-xl w-24 h-24" style="filter: grayscale(1)">
          <span class="text-white text-xs">gray</span>
        </div>
        <div class="flex flex-col items-center justify-center bg-brand rounded-xl w-24 h-24" style="filter: saturate(2)">
          <span class="text-white text-xs">saturate</span>
        </div>
      </div>
    </div>
  </div>
</template>
