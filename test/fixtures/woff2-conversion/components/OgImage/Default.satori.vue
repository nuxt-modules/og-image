<script setup lang="ts">
defineProps<{
  title: string
  description?: string
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
    }"
  >
    <h1
      :style="{
        fontSize: '72px',
        fontWeight: 700,
        color: '#ffffff',
        marginBottom: '20px',
        fontFamily: 'Inter',
      }"
    >
      {{ title }}
    </h1>
    <p
      v-if="description"
      :style="{
        fontSize: '32px',
        fontWeight: 400,
        color: '#a0a0a0',
        fontFamily: 'Inter',
      }"
    >
      {{ description }}
    </p>
    <!-- Weight debug section -->
    <div :style="{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '8px' }">
      <span :style="{ fontSize: '28px', fontWeight: 400, color: '#888', fontFamily: 'Inter' }">
        Inter 400: The quick brown fox
      </span>
      <span :style="{ fontSize: '28px', fontWeight: 700, color: '#888', fontFamily: 'Inter' }">
        Inter 700: The quick brown fox
      </span>
      <span :style="{ fontSize: '28px', fontWeight: 400, color: '#888', fontFamily: 'Roboto' }">
        Roboto 400: The quick brown fox
      </span>
      <span :style="{ fontSize: '28px', fontWeight: 700, color: '#888', fontFamily: 'Roboto' }">
        Roboto 700: The quick brown fox
      </span>
    </div>
  </div>
</template>
