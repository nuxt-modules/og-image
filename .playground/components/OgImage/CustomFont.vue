<script setup lang="ts">
const props = defineProps({
  path: String,
  title: String,
  description: String,
  themeColor: String,
  appName: String
})

const theme = computed(() => props.themeColor || '#dbf4ff')
</script>

<template>
<div :style="{ fontFamily: 'optieinstein', fontWeight: 400, padding: '0 60px', width: '100%', height: '100%', backgroundColor: '#0c0c0c', backgroundImage: 'linear-gradient(to bottom, ' + theme + ', #fff1f1)', display: 'flex', alignItems: 'center' }">
  <div :style="{ padding: '0 30px', display: 'flex', flexDirection: 'column' }">
    <p :style="{ fontSize: '75px', fontWeight: 'bold', marginBottom: '20px' }">{{ title }}</p>
    <p :style="{ fontSize: '35px', fontWeight: 400 }">{{ description }}</p>
    <p class="inline-style">Test inline style, colour should be red</p>
  </div>
  <div :style="{ position: 'absolute', top: '50px', left: '50px', fontSize: '40px', fontWeight: 300 }">{{ appName }}</div>
</div>
</template>
<style scoped>
.inline-style {
  color: red;
}
</style>
