<script setup>
definePageMeta({
  title: 'Home',
  description: 'This is the home page',
  breadcrumbTitle: 'Home'
})

useHead({
  title: 'Home',
})

const host = computed(() => typeof window !== 'undefined' ? window.location.href : '/')

const color = ref('bg-green-500')
const title = ref('Fully dynamic')

const time = ref('')

function setTime() {
  const date = new Date()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = date.getSeconds()
  // use am pm
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const hours12 = hours % 12 || 12
  time.value = `${hours12}:${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds} ${ampm}`
}

setTime()

let interval = null
onMounted(() => {
  interval = setInterval(() => {
    setTime()
  }, 15000)
})

onBeforeUnmount(() => {
  clearInterval(interval)
})
</script>
<template>
<div class="px-7 my-5">
  <OgImageStatic description="My description of the home page." theme-color="#b5ffd6" />
  <div class="mb-10 xl:grid grid-cols-2 gap-10 justify-center">
    <div>
      <h2 class="text-2xl mb-10 ">Static</h2>
      <h3 class="text-lg font-bold mb-3">Browser Screenshot</h3>
      <div class="lg:grid grid-cols-2 gap-5">
        <div>
          <NuxtLink external no-prefetch to="/browser/custom" target="_blank">
            <div class="mb-2">Page</div>
            <img :src="`${host}browser/custom/__og_image__/og.png`" width="400" height="210" class="rounded" />
          </NuxtLink>
        </div>
        <div>
          <NuxtLink external no-prefetch to="/browser/component" target="_blank">
            <div class="mb-2">Vue Component</div>
            <img :src="`${host}browser/component/__og_image__/og.png`" width="400" height="210" class="rounded" />
          </NuxtLink>
        </div>
      </div>
      <hr class="my-10">
      <h2 class="text-lg font-bold mb-3">Satori</h2>
      <div class="lg:grid grid-cols-2 gap-5">
        <NuxtLink external no-prefetch to="/satori/static/__og_image__/" target="_blank">
          <div class="mb-2">Default template</div>
          <img :src="`${host}satori/static/__og_image__/og.png`" width="400" height="210" class="rounded" />
        </NuxtLink>
        <NuxtLink external no-prefetch to="/satori/image/__og_image__/" target="_blank">
          <div class="mb-2">Image</div>
          <img :src="`${host}satori/image/__og_image__/og.png`" width="400" height="210" class="rounded" />
        </NuxtLink>
      </div>
    </div>
    <div>
      <h2 class="text-2xl mb-10 ">Dynamic</h2>
      <h3 class="text-lg font-bold mb-3">Satori</h3>
      <div class="lg:grid grid-cols-2 gap-5">
        <NuxtLink external no-prefetch to="/satori/dynamic/__og_image__/" target="_blank">
          <div class="mb-2">Current time <span class="text-xs opacity-70">updates every 15 seconds</span></div>
          <img :src="`${host}satori/dynamic/__og_image__/og.png?description=&title=${time}`" width="400" height="210" class="rounded" />
        </NuxtLink>
        <div>
          <label class="block">Colour
            <input type="color" v-model="color">
          </label>
          <label>Title
            <input type="text" v-model="title" class="border-1 border-gray-200 px-2 py-1 mb-1">
          </label>
          <NuxtLink external no-prefetch to="/satori/tailwind/__og_image__/" target="_blank">
            <div class="mb-2">Tailwind</div>
            <img :src="`${host}satori/tailwind/__og_image__/og.png?title=${encodeURIComponent(title)}&bgColor=${color.replace('#', '')}`" width="400" height="210" class="rounded" />
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</div>
</template>
