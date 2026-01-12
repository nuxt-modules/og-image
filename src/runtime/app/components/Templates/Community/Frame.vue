<script setup lang="ts">
/**
 * @credits @arashsheyda <https://github.com/arashsheyda>
 */

withDefaults(defineProps<{
  title?: string
  description?: string
  bg?: string
  icon?: string
  logo?: string
  image?: string
  username?: string
  socials?: { name: string, icon: string }[]
}>(), {
  bg: 'linear-gradient(145deg, #1c1c1c 0%, #0d0d0d 100%)',
})
</script>

<template>
  <div
    class="relative h-full w-full flex items-center justify-center text-white overflow-hidden"
    :style="{ backgroundImage: bg }"
  >
    <!-- Inner frame with refined border -->
    <div class="absolute inset-4 border border-white/20 rounded-sm" />
    <div class="absolute inset-5 border border-white/10 rounded-sm" />

    <!-- Background image with better treatment -->
    <div
      v-if="image"
      class="absolute inset-0 w-full h-full bg-cover bg-center opacity-[0.07]"
      :style="{ backgroundImage: `url(${image})` }"
    />

    <!-- Subtle corner accents -->
    <div class="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-white/30" />
    <div class="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-white/30" />
    <div class="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-white/30" />
    <div class="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-white/30" />

    <div class="flex flex-col items-center text-center px-8 lg:px-20 relative z-10">
      <h1 class="flex items-center gap-5 text-[72px] font-bold leading-tight tracking-tight" style="display: block; line-clamp: 2; text-overflow: ellipsis; text-shadow: 0 4px 30px rgba(0,0,0,0.5);">
        <Icon
          v-if="icon"
          :name="icon"
          class="opacity-90"
        />
        {{ title }}
      </h1>
      <p v-if="description" class="text-[28px] max-w-[800px] text-white/70 mt-4 leading-relaxed" style="display: block; line-clamp: 3; text-overflow: ellipsis;">
        {{ description }}
      </p>
    </div>

    <img
      v-if="logo"
      :src="logo"
      class="absolute bottom-6 left-6"
      style="height: 100px; width: auto; opacity: 0.9; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3));"
    >
    <div class="absolute bottom-6 right-6 flex items-center gap-4">
      <div
        v-if="username"
        class="text-white/60 font-medium text-lg mr-2"
      >
        {{ username }}
      </div>
      <Icon
        v-for="social of socials"
        :key="social.name"
        :name="social.icon!"
        class="w-6 h-6 text-white/50"
      />
    </div>
  </div>
</template>
