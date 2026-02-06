<script setup lang="ts">
/**
 * @credits Takumi <https://takumi.kane.tw/>
 */

withDefaults(defineProps<{
  colorMode?: 'dark' | 'light'
  productName?: string
  price?: string
  description?: string
  image?: string
  brand?: string
}>(), {
  colorMode: 'light',
  productName: 'Product Name',
  price: '$99',
  description: 'A fantastic product that solves your problems',
  brand: 'Brand',
})
</script>

<template>
  <div
    class="w-full h-full flex p-10 items-center justify-center bg-neutral-100 dark:bg-neutral-800"
  >
    <div
      class="w-full h-full flex overflow-hidden bg-white dark:bg-neutral-900"
      style="border-radius: 32px; box-shadow: 0 20px 50px rgba(0,0,0,0.08);"
    >
      <div
        class="flex-1 flex items-center justify-center p-10 bg-neutral-50 dark:bg-neutral-800"
        style="border-top-left-radius: 32px; border-bottom-left-radius: 32px;"
      >
        <img
          v-if="image"
          :src="image"
          alt="Product"
          style="width: 200px; height: 200px; object-fit: contain;"
        >
      </div>
      <div
        class="flex-1 flex flex-col justify-center"
        style="padding: 50px 60px;"
      >
        <div class="flex flex-col gap-2">
          <span
            class="text-[22px] font-bold uppercase text-blue-600"
            style="letter-spacing: 0.1em;"
          >
            {{ brand }}
          </span>
          <span
            class="text-[60px] font-black text-neutral-900 dark:text-neutral-100"
            style="line-height: 1.1; letter-spacing: -0.02em;"
          >
            {{ productName }}
          </span>
        </div>

        <span
          class="text-[28px] font-normal text-neutral-500 dark:text-neutral-400"
          style="line-height: 1.5; margin-top: 24px; margin-bottom: 32px;"
        >
          {{ description }}
        </span>

        <div class="text-[52px] font-extrabold text-blue-600">
          {{ price }}
        </div>
      </div>
    </div>
  </div>
</template>
