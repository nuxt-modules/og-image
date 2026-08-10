<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div
    :style="{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      backgroundColor: '#1a1a2e',
      padding: '60px',
      justifyContent: 'center',
      alignItems: 'center',
    }"
  >
    <h1
      :style="{
        fontSize: '72px',
        fontWeight: 400,
        color: '#ffffff',
        fontFamily: 'Noto Sans SC',
      }"
    >
      {{ title }}
    </h1>
  </div>
</template>
