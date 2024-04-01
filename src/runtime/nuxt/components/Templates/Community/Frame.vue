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
  bg: 'linear-gradient(to bottom right, #171717, #131313)',
})
</script>

<template>
  <div
    class="relative h-full w-full flex items-center justify-center bg-neutral-900 text-white border-2 border-white"
    :style="{ backgroundImage: bg }"
  >
    <div
      v-if="image"
      class="absolute inset-0 w-full h-full bg-center opacity-10"
      :style="{ backgroundImage: `url(${image})` }"
    />
    <div class="flex flex-col items-center text-center">
      <h1 class="flex gap-4 text-7xl font-bold">
        <Icon
          v-if="icon"
          :name="icon"
        />
        {{ title }}
      </h1>
      <p class="text-2xl max-w-3xl">
        {{ description }}
      </p>
    </div>

    <img
      v-if="logo"
      :src="logo"
      class="absolute bottom-0 left-0 p-5"
      style="height: 125px; width: 153px;"
    >
    <div class="absolute bottom-5 right-5 flex gap-4">
      <div
        v-if="username"
        class="absolute bottom-12 right-8 font-bold"
      >
        {{ username }}
      </div>
      <Icon
        v-for="social of socials"
        :key="social.name"
        :name="social.icon!"
        class="w-7 h-7"
      />
    </div>
  </div>
</template>
