<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <div class="w-full h-full flex flex-col bg-elevated p-3">
    <!-- Left: Large primary panel for color detection -->
    <div class="w-32 bg-primary rounded-lg mr-3 p-2 flex flex-col justify-center">
      <h1 class="text-lg font-bold text-white">
        {{ title }}
      </h1>
      <p class="text-primary-200 text-xs mt-1">
        Primary
      </p>
    </div>

    <!-- Right: All semantic colors -->
    <div class="flex-1 flex flex-wrap content-start text-xs">
      <!-- Nuxt UI semantic colors -->
      <div class="bg-primary text-white px-2 py-0.5 m-0.5 rounded">
        primary
      </div>
      <div class="bg-secondary text-white px-2 py-0.5 m-0.5 rounded">
        secondary
      </div>
      <div class="bg-success text-white px-2 py-0.5 m-0.5 rounded">
        success
      </div>
      <div class="bg-warning text-white px-2 py-0.5 m-0.5 rounded">
        warning
      </div>
      <div class="bg-error text-white px-2 py-0.5 m-0.5 rounded">
        error
      </div>
      <div class="bg-info text-white px-2 py-0.5 m-0.5 rounded">
        info
      </div>

      <!-- @theme custom colors -->
      <div class="bg-brand text-white px-2 py-0.5 m-0.5 rounded">
        brand
      </div>
      <div class="bg-accent text-white px-2 py-0.5 m-0.5 rounded">
        accent
      </div>
      <div class="bg-highlight text-white px-2 py-0.5 m-0.5 rounded">
        highlight
      </div>
      <div class="bg-ocean text-white px-2 py-0.5 m-0.5 rounded">
        ocean
      </div>
      <div class="bg-forest text-white px-2 py-0.5 m-0.5 rounded">
        forest
      </div>
      <div class="bg-sunset text-white px-2 py-0.5 m-0.5 rounded">
        sunset
      </div>
      <div class="bg-surface text-white px-2 py-0.5 m-0.5 rounded">
        surface
      </div>

      <!-- Custom color shades -->
      <div class="bg-custom-100 px-2 py-0.5 m-0.5 rounded">
        custom-100
      </div>
      <div class="bg-custom-300 px-2 py-0.5 m-0.5 rounded">
        custom-300
      </div>
      <div class="bg-custom-500 text-white px-2 py-0.5 m-0.5 rounded">
        custom-500
      </div>
      <div class="bg-custom-700 text-white px-2 py-0.5 m-0.5 rounded">
        custom-700
      </div>
      <div class="bg-custom-900 text-white px-2 py-0.5 m-0.5 rounded">
        custom-900
      </div>

      <!-- Text with custom colors -->
      <div class="text-brand px-2 py-0.5 m-0.5 font-bold">
        text-brand
      </div>
      <div class="text-accent px-2 py-0.5 m-0.5 font-bold">
        text-accent
      </div>
      <div class="text-highlight px-2 py-0.5 m-0.5 font-bold">
        text-highlight
      </div>
      <div class="text-custom-500 px-2 py-0.5 m-0.5 font-bold">
        text-custom
      </div>

      <!-- Nuxt UI neutral backgrounds -->
      <div class="bg-muted px-2 py-0.5 m-0.5 rounded">
        muted
      </div>
      <div class="bg-accented px-2 py-0.5 m-0.5 rounded">
        accented
      </div>
      <div class="bg-inverted text-inverted px-2 py-0.5 m-0.5 rounded">
        inverted
      </div>

      <!-- Borders with custom colors -->
      <div class="border-2 border-brand text-brand px-2 py-0.5 m-0.5 rounded">
        border-brand
      </div>
      <div class="border-2 border-accent text-accent px-2 py-0.5 m-0.5 rounded">
        border-accent
      </div>
      <div class="border-2 border-custom-500 text-custom-500 px-2 py-0.5 m-0.5 rounded">
        border-custom
      </div>

      <!-- Linear gradients -->
      <div class="bg-gradient-to-r from-brand to-accent text-white m-1 rounded-lg w-32 h-16 flex items-center justify-center font-bold">
        linear→
      </div>
      <div class="bg-gradient-to-b from-ocean to-forest text-white m-1 rounded-lg w-32 h-16 flex items-center justify-center font-bold">
        linear↓
      </div>

      <!-- Radial gradients -->
      <div class="bg-radial from-highlight to-accent text-white m-1 rounded-lg w-32 h-16 flex items-center justify-center font-bold">
        radial
      </div>
      <div class="bg-radial-at-tl from-brand to-ocean text-white m-1 rounded-lg w-32 h-16 flex items-center justify-center font-bold">
        radial-tl
      </div>

      <!-- Mask with inline styles (Satori supports mask-image) -->
      <div class="bg-brand text-white m-1 rounded-lg w-32 h-16 flex items-center justify-center font-bold" style="mask-image: linear-gradient(to right, black 0%, transparent 100%)">
        mask-lin
      </div>
      <div class="bg-accent text-white m-1 rounded-lg w-32 h-16 flex items-center justify-center font-bold" style="mask-image: radial-gradient(circle at center, black 0%, transparent 100%)">
        mask-rad
      </div>

      <!-- Filter demo boxes (icons don't work with Satori) -->
      <div class="m-2 flex flex-col items-center justify-center bg-zinc-800 rounded-xl w-48 h-48">
        <div class="w-32 h-32 bg-gradient-to-br from-green-400 to-blue-600 rounded-lg" />
        <span class="text-white text-sm mt-2">normal</span>
      </div>
      <div class="m-2 flex flex-col items-center justify-center bg-zinc-800 rounded-xl w-48 h-48" style="filter: brightness(1.5)">
        <div class="w-32 h-32 bg-gradient-to-br from-green-400 to-blue-600 rounded-lg" />
        <span class="text-white text-sm mt-2">bright</span>
      </div>
      <div class="m-2 flex flex-col items-center justify-center bg-zinc-800 rounded-xl w-48 h-48" style="filter: grayscale(1)">
        <div class="w-32 h-32 bg-gradient-to-br from-green-400 to-blue-600 rounded-lg" />
        <span class="text-white text-sm mt-2">gray</span>
      </div>
      <div class="m-2 flex flex-col items-center justify-center bg-zinc-800 rounded-xl w-48 h-48" style="filter: saturate(2)">
        <div class="w-32 h-32 bg-gradient-to-br from-green-400 to-blue-600 rounded-lg" />
        <span class="text-white text-sm mt-2">saturate</span>
      </div>
    </div>
  </div>
</template>
