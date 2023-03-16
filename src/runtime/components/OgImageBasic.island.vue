<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  path: String,
  title: {
    type: String,
    default: 'Og Image Template',
  },
  description: {
    type: String,
    default: 'Set a description to change me.',
  },
  background: {
    type: String,
    default: 'linear-gradient(to bottom, #dbf4ff, #fff1f1)',
  },
  color: {
    type: String,
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

const containerAttrs = computed(() => {
  const isBackgroundTw = props.background?.startsWith('bg-')
  const isColorTw = props.color?.startsWith('text-')

  const classes = [
    'w-full',
    'h-full',
    'flex',
    'items-center',
    'justify-center',
  ]
  const styles: Record<string, any> = {
    padding: props.padding,
  }

  if (isBackgroundTw)
    classes.push(props.background)
  else if (props.background)
    styles.background = props.background

  if (isColorTw)
    classes.push(props.color)
  else
    styles.color = props.color
  return { class: classes, style: styles }
})

const titleAttrs = computed(() => {
  const classes = []
  const styles = {
    fontWeight: 'bold',
    marginBottom: '20px',
    fontSize: props.titleFontSize,
  }
  return { class: classes, style: styles }
})

const descriptionAttrs = computed(() => {
  const classes = []
  const styles = {
    fontSize: props.descriptionFontSize,
  }
  return { class: classes, style: styles }
})
</script>

<template>
  <div v-bind="containerAttrs">
    <div class="flex flex-col w-full">
      <div v-bind="titleAttrs">
        {{ title || 'Null Title' }}
      </div>
      <div v-if="description" v-bind="descriptionAttrs">
        {{ description }}
      </div>
    </div>
  </div>
</template>
