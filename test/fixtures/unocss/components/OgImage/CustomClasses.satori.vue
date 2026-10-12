<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <div class="box-border w-full h-full flex bg-surface p-4">
    <!-- Left: Title panel with gradient -->
    <div class="box-border w-48 rounded-xl mr-4 p-4 flex flex-col justify-center" style="background: linear-gradient(to bottom, #f29101, #8b5cf6)">
      <h1 class="box-border flex flex-wrap gap-[0.2em] my-[21.44px] text-2xl font-bold text-white">
        UnoCSS
      </h1>
      <p class="box-border flex flex-wrap gap-[0.2em] text-white/80 text-sm mt-1 mb-4">
        {{ title || 'Test' }}
      </p>
    </div>

    <!-- Right: Color swatches and features -->
    <div class="box-border flex-1 flex flex-wrap content-start gap-2 text-sm">
      <!-- Theme colors -->
      <div class="box-border flex flex-col bg-primary-500 text-white px-3 py-1 rounded-lg">
        primary
      </div>
      <div class="box-border flex flex-col bg-brand text-white px-3 py-1 rounded-lg">
        brand
      </div>
      <div class="box-border flex flex-col bg-accent text-white px-3 py-1 rounded-lg">
        accent
      </div>
      <div class="box-border flex flex-col bg-highlight text-white px-3 py-1 rounded-lg">
        highlight
      </div>
      <div class="box-border flex flex-col bg-ocean text-white px-3 py-1 rounded-lg">
        ocean
      </div>
      <div class="box-border flex flex-col bg-forest text-white px-3 py-1 rounded-lg">
        forest
      </div>
      <div class="box-border flex flex-col bg-sunset text-white px-3 py-1 rounded-lg">
        sunset
      </div>

      <!-- Text colors -->
      <div class="box-border flex flex-col text-brand font-bold px-3 py-1">
        text-brand
      </div>
      <div class="box-border flex flex-col text-accent font-bold px-3 py-1">
        text-accent
      </div>
      <div class="box-border flex flex-col text-highlight font-bold px-3 py-1">
        text-highlight
      </div>

      <!-- Borders -->
      <div class="box-border flex flex-col border-solid border-2 border-brand text-brand px-3 py-1 rounded-lg">
        border
      </div>
      <div class="box-border flex flex-col border-solid border-2 border-accent text-accent px-3 py-1 rounded-lg">
        border
      </div>

      <!-- Gradients (using hex colors directly for UnoCSS gradient utilities) -->
      <div class="box-border text-white rounded-lg w-36 h-16 flex items-center justify-center font-bold" style="background: linear-gradient(to right, #f29101, #8b5cf6)">
        linear
      </div>
      <div class="box-border text-white rounded-lg w-36 h-16 flex items-center justify-center font-bold" style="background: linear-gradient(to bottom, #0ea5e9, #22c55e)">
        vertical
      </div>
      <div class="box-border text-white rounded-lg w-36 h-16 flex items-center justify-center font-bold" style="background: linear-gradient(to bottom right, #ec4899, #f97316)">
        diagonal
      </div>

      <!-- Filter demo boxes -->
      <div class="box-border flex gap-2 mt-2">
        <div class="box-border flex flex-col items-center justify-center bg-brand rounded-xl w-24 h-24">
          <span class="box-border text-white text-xs">normal</span>
        </div>
        <div class="box-border flex flex-col items-center justify-center bg-brand rounded-xl w-24 h-24" style="filter: brightness(1.5)">
          <span class="box-border text-white text-xs">bright</span>
        </div>
        <div class="box-border flex flex-col items-center justify-center bg-brand rounded-xl w-24 h-24" style="filter: grayscale(1)">
          <span class="box-border text-white text-xs">gray</span>
        </div>
        <div class="box-border flex flex-col items-center justify-center bg-brand rounded-xl w-24 h-24" style="filter: saturate(2)">
          <span class="box-border text-white text-xs">saturate</span>
        </div>
      </div>
    </div>
  </div>
</template>
