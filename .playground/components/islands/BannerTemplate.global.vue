<script setup lang="ts">
const props = defineProps({
  path: String,
  title: String,
  description: String,
})
</script>

<template>
<div :style="{ padding: '0 60px', width: '100%', height: '100%', backgroundColor: '#0c0c0c', backgroundImage: 'linear-gradient(to bottom, #dbf4ff, #fff1f1)', display: 'flex', alignItems: 'center' }">
  <div :style="{ padding: '0 30px', display: 'flex', flexDirection: 'column' }">
    <p :style="{ fontSize: '60px', fontWeight: 'bold', marginBottom: '20px' }">{{ title }}</p>
    <p :style="{ fontSize: '26px', }">{{ description }}</p>
  </div>
</div>
</template>
