<script setup lang="ts">
const { title = 'Kusosa PRO', description = 'Gérez votre agence' } = defineProps<{
  title?: string
  description?: string
}>()
</script>

<template>
  <div
    style="font-family: 'Inter', sans-serif"
    class="w-full h-full flex items-center justify-center bg-[#161616] relative overflow-hidden"
  >
    <div class="absolute top-[-20%] left-[-10%] w-200 h-200 bg-[#561217] rounded-full opacity-[0.25]" />

    <div class="w-full flex flex-col items-center justify-center px-16 relative text-center">
      <div class="flex flex-col items-center gap-5 mb-10">
        <span class="text-4xl font-black uppercase tracking-[0.2em] text-white">
          Kusosa <span
            style="color: #F5AE1B;"
            class="ml-2"
          >Pro</span>
        </span>
      </div>

      <h1 class="text-6xl font-black text-white m-0 mb-8 max-w-5xl">
        {{ title }}
      </h1>

      <p class="text-3xl text-gray-200 leading-normal max-w-4xl m-0 font-normal">
        {{ description }}
      </p>
    </div>
  </div>
</template>
