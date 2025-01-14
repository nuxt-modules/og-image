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
  justifyContent: 'center',
  color: 'white',
}
</script>

<template>
  <div :style="containerStyles">
    <div :style="{ position: 'absolute', top: '170px', left: '250px', fontSize: '25px', display: 'flex', alignItems: 'center' }">
      <img src="/harlan-wilton.jpeg" width="100" height="100" :style="{ borderRadius: '12px', marginRight: '8px' }">
    </div>
    <img src="harlan-wilton.jpeg" width="100" height="100" :style="{ borderRadius: '12px', marginRight: '8px' }">
    <img src="assets/static/images/picture.jpg" width="100" height="100" :style="{ borderRadius: '12px', marginRight: '8px' }">
    <img src="https://avatars.githubusercontent.com/u/5326365?v=4" width="200" height="200" alt="absolute test">
  </div>
</template>
