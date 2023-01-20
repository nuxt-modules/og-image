<script setup lang="ts">
const props = defineProps({
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
  color: 'white'
}
</script>

<template>
<div :style="containerStyles">
  <div :style="{ position: 'absolute', top: '170px', left: '450px', fontSize: '25px', display: 'flex', alignItems: 'center',  }">
    <img src="/harlan-wilton.jpeg" width="225" height="225" :style="{ borderRadius: '12px', marginRight: '8px' }">
  </div>
</div>
</template>
