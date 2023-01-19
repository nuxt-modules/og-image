<script>
definePageMeta({
  title: 'Home',
  description: 'This is the home page',
  breadcrumbTitle: 'Home'
})
</script>
<template>
<div class="px-5 my-10">
  <h1 class="text-3xl mb-5">Nuxt Og Image Test</h1>
  <div class="mb-10">
  <h2 class="text-lg font-bold mb-3">Browser Screenshot</h2>
    <div><NuxtLink to="/browser/custom">custom</NuxtLink></div>
    <div><NuxtLink to="/browser/component">component</NuxtLink></div>
  </div>
  <h2 class="text-lg font-bold mb-3">Satori</h2>
  <div><NuxtLink to="/satori/static">static</NuxtLink></div>
  <div><NuxtLink to="/satori/static">dynamic</NuxtLink></div>
</div>
</template>
