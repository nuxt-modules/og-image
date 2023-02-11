<script setup lang="ts">
defineProps({
  path: String,
  title: String,
  description: String,
  background: {
    type: String,
    default: 'linear-gradient(to bottom, #dbf4ff, #fff1f1)',
  },
  padding: {
    type: String,
    default: '0 100px',
  },
  titleFontSize: {
    type: String,
    default: '60px',
  },
  descriptionFontSize: {
    type: String,
    default: '26px',
  },
})
</script>

<template>
  <div :style="{ padding, width: '100%', height: '100%', background, display: 'flex', alignItems: 'center' }">
    <div :style="{ display: 'flex', flexDirection: 'column' }">
      <p :style="{ fontSize: titleFontSize, fontWeight: 'bold', marginBottom: '20px' }">
        {{ title || 'Og Image Template' }}
      </p>
      <p :style="{ fontSize: descriptionFontSize }">
        {{ description || 'Set a description to change me.' }}
      </p>
    </div>
  </div>
</template>
