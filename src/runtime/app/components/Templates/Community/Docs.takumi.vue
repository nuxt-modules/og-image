<script setup lang="ts">
/**
 * @credits Takumi <https://takumi.kane.tw/>
 */

withDefaults(defineProps<{
  colorMode?: 'dark' | 'light'
  title?: string
  description?: string
  icon?: string
  primaryColor?: string
  primaryTextColor?: string
  site?: string
}>(), {
  colorMode: 'dark',
  title: 'Documentation',
  description: 'Comprehensive documentation for your project',
  primaryColor: 'hsla(354, 90%, 54%, 0.3)',
  primaryTextColor: 'hsl(354, 90%, 60%)',
  site: 'Docs',
})
</script>

<template>
  <div
    class="w-full h-full relative flex flex-col overflow-hidden bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white"
    :style="{
      backgroundImage: `linear-gradient(to bottom right, ${primaryColor}, transparent)`,
    }"
  >
    <div class="flex flex-col w-full h-full p-[60px] relative justify-between">
      <div class="flex flex-col gap-8 mb-10" style="text-wrap: pretty;">
        <span
          class="text-[72px] font-extrabold"
          style="line-height: 1.1; letter-spacing: -0.04em;"
        >
          {{ title }}
        </span>
        <span
          class="text-[44px] font-normal text-neutral-500 dark:text-neutral-400"
          style="line-height: 1.4; max-width: 95%; letter-spacing: -0.01em; line-clamp: 2; text-overflow: ellipsis; overflow: hidden;"
        >
          {{ description }}
        </span>
      </div>

      <div class="flex items-center gap-7">
        <img
          v-if="icon"
          :src="icon"
          alt="Icon"
          class="w-16 h-16"
          style="object-fit: contain;"
        >
        <span
          class="text-[32px] font-bold"
          style="letter-spacing: -0.02em; opacity: 0.9;"
        >
          {{ site }}
        </span>
        <div style="flex-grow: 1;" />
        <div
          :style="{
            height: '4px',
            width: '60px',
            backgroundColor: primaryColor,
            borderRadius: '2px',
          }"
        />
        <span
          class="text-[22px] font-bold uppercase"
          :style="{
            letterSpacing: '0.2em',
            color: primaryTextColor,
            opacity: 0.8,
          }"
        >
          Documentation
        </span>
      </div>
    </div>
  </div>
</template>
