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
  backgroundImage: 'url(/dddepth-209.jpg)',
  backgroundSize: 'cover',
  display: 'flex',
  alignItems: 'center',
  color: 'white',
}
</script>

<template>
  <div :style="containerStyles">
    <div :style="{ position: 'absolute', top: '170px', left: '450px', fontSize: '25px', display: 'flex', alignItems: 'center' }">
      <img src="/harlan-wilton.jpeg" width="225" height="225" :style="{ borderRadius: '12px', marginRight: '8px' }">
    </div>
    <img src="https://avatars.githubusercontent.com/u/5326365?v=4" alt="absolute test">
  </div>
</template>
