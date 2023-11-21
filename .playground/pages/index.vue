<script setup>
import { computed, definePageMeta, onBeforeUnmount, onMounted, ref, useDebounceFn, useServerSeoMeta, watch } from '#imports'

definePageMeta({
  title: 'Home',
  description: 'This is the home page',
  breadcrumbTitle: 'Home',
})

useServerSeoMeta({
  title: 'Home & //<"With Encoding">\\\\',
  ogTitle: 'Home & //<"With Encoding">\\\\',
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
  time.value = `${hours12}:${minutes < 10 ? `0${minutes}` : minutes}:${seconds < 10 ? `0${seconds}` : seconds} ${ampm}`
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

const tailwindUrl = ref(`${host.value}satori/tailwind/__og_image__/og.png?title=${encodeURIComponent(title.value)}&bgColor=${color.value.replace('#', '')}`)

const setTailwindUrl = useDebounceFn(() => {
  // do something
  tailwindUrl.value = `${host.value}satori/tailwind/__og_image__/og.png?title=${encodeURIComponent(title.value)}&bgColor=${color.value.replace('#', '')}`
}, 500)

watch([color, title], () => {
  // do debounce
  setTailwindUrl()
})
</script>

<template>
  <div class="px-7 my-5">
    <OgImage description="My description of the home page." theme-color="#b5ffd6" />
    <img :src="`${host}satori/static/__og_image__/og.png`" width="400" height="210" class="rounded">
  </div>
</template>
