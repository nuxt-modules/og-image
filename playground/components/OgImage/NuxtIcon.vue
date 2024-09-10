<script setup lang="ts">
defineProps({
  path: String,
  title: String,
  description: String,
})

const containerStyles = {
  padding: '0 60px',
  width: '100%',
  height: '100%',
  backgroundColor: '#0c0c0c',
  backgroundImage: 'linear-gradient(to bottom right, #111827, #0E262C 75%)',
  display: 'flex',
  alignItems: 'center',
  color: 'white',
}
</script>

<template>
  <div :style="containerStyles">
    <div>{{ title }}</div>
    <div>{{ description }}</div>
    <Icon name="carbon:book" size="250px" class="text-blue-500/30" style="margin: 0 auto;" />
    <Icon name="carbon:star" size="250px" class="text-blue-500" style="margin: 0 auto;" />
    <Icon name="uil:github" size="250px" class="text-blue-500" style="margin: 0 auto;" />
  </div>
</template>
