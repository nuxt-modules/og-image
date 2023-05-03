<script setup lang="ts">
definePageMeta({
  title: 'About',
  description: 'My description',
  image: 'https://example.com/image.jpg',
})

const counter = ref(0)
const increment = () => {
  counter.value++
}
let interval: any
onMounted(() => {
  interval = setInterval(() => {
    increment()
  }, 200)
})
onUnmounted(() => {
  clearInterval(interval)
})
</script>
<template>
<div class="custom-screenshot" style="width: 2000px; height: 1000px; display: flex; background-color: #0047e1; color: white; padding: 200px; font-size: 5rem; align-items: center;">
  <OgImageScreenshot
    :selector="'.custom-screenshot'"
    :mask="'.hidden-element'"
    :width="2000"
    :height="1000"
    :delay="300"
  />
  <div>
    <div>
      Custom screenshot
    </div>
    <div class="hidden-element">
      this should be hidden
    </div>
    <div>
      Counter: {{counter}}
    </div>
  </div>
</div>
</template>
