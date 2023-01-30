<script lang="ts" setup>
useHead({
  title: 'Nuxt OG Image',
})
</script>

<template>
<div class="flex-col flex min-h-screen">
  <header class="w-full flex-shrink border-r-1 border-light-400 dark:(border-dark-400 bg-dark-900 text-light) bg-white text-dark-800 flex flex-col justify-between">
    <div class="py-3 w-full flex items-start px-5 justify-between space-x-5">
      <h1 class="text-base hidden md:block w-40">
        Nuxt OG Image
      </h1>
      <NDarkToggle>
        <template #default="{ toggle }">
        <NButton n="borderless lg m-0" p-0 op50 @click="toggle">
          <NIcon icon="dark:carbon-moon carbon-sun" />
        </NButton>
        </template>
      </NDarkToggle>
    </div>
    <hr class="border-1 border-light-400 dark:border-dark-400">
  </header>
  <main class="flex-grow h-full mx-auto flex flex-col w-full bg-white dark:bg-black overflow-hidden dark:bg-dark-700 bg-light-200 ">
    <div class="h-full max-h-full overflow-hidden lg:p-10 p-3">
      <NuxtPage />
    </div>
  </main>
</div>
</template>
