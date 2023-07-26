<script setup lang="ts">
import { computed, resolveComponent } from 'vue'
import { useSiteConfig } from '#imports'

// inherited attrs can mess up the satori parser
defineOptions({
  inheritAttrs: false,
})

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
  color: {
    type: String,
  },
  padding: {
    type: String,
    default: '0 100px',
  },
  titleFontSize: {
    type: String,
    default: '75px',
  },
  descriptionFontSize: {
    type: String,
    default: '35px',
  },
  icon: {
    type: [String, Boolean],
    default: false,
  },
  siteName: {
    type: String,
    required: false,
  },
  siteLogo: {
    type: String,
    required: false,
  },
})

const backgroundAttrs = computed(() => {
  // we want to make a
  // const isBackgroundTw = props.background?.startsWith('bg-')
  return {
    style: {
      display: 'flex',
      position: 'absolute',
      width: '100%',
      height: '100%',
      background: 'rgba(5, 5, 5,1)',
    },
  }
})

const backgroundFlareAttrs = computed(() => {
  // we want to make a
  // const isBackgroundTw = props.background?.startsWith('bg-')
  return {
    style: {
      display: 'flex',
      position: 'absolute',
      right: '-100%',
      top: '10%',
      width: '200%',
      height: '200%',
      backgroundImage: 'radial-gradient(circle, rgba(0,220,130, 0.5) 0%,  rgba(5, 5, 5,0.3) 50%, rgba(5, 5, 5,0) 70%)',
    },
  }
})

const containerAttrs = computed(() => {
  const isColorTw = props.color?.startsWith('text-')

  const classes = [
    'w-full',
    'h-full',
    'flex',
    'text-gray-100',
    'relative',
    'items-center',
    'justify-center',
  ]
  const styles: Record<string, any> = {
    padding: props.padding,
  }
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
    marginBottom: '50px',
    fontSize: props.titleFontSize,
  }
  return { class: classes, style: styles }
})

const descriptionAttrs = computed(() => {
  const classes = []
  const styles = {
    fontSize: props.descriptionFontSize,
    lineHeight: `${props.descriptionFontSize.replace('px', '') * 1.5}px`,
    opacity: '0.8',
  }
  return { class: classes, style: styles }
})

const siteConfig = useSiteConfig()
const siteName = computed(() => {
  return props.siteName || siteConfig.name
})
const siteLogo = computed(() => {
  return props.siteLogo || siteConfig.logo
})

const MaybeIconComponent = resolveComponent('Icon')
</script>

<template>
  <div v-bind="backgroundAttrs" />
  <div v-bind="backgroundFlareAttrs" />
  <div v-bind="containerAttrs">
    <div class="flex flex-row justify-between items-center" style="margin-bottom: 100px;">
      <div class="flex flex-col w-full" :style="icon ? { width: '65%' } : {}">
        <div v-bind="titleAttrs">
          {{ title || 'Null Title' }}
        </div>
        <div v-if="description" v-bind="descriptionAttrs">
          {{ description }}
        </div>
      </div>
      <div v-if="typeof icon === 'string' && typeof MaybeIconComponent !== 'string'" style="width: 30%;" class="flex justify-end">
        <MaybeIconComponent :name="icon" size="250px" style="margin: 0 auto 0 100px;opacity: 0.9;" />
      </div>
    </div>
    <div class="flex flex-row absolute bottom-10 text-left items-start">
      <img v-if="siteLogo" :src="siteLogo" height="30">
      <div v-else-if="siteName" style="font-size: 25px;" class="font-bold">
        {{ siteName }}
      </div>
    </div>
  </div>
</template>
