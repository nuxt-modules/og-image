<script setup lang="ts">
import { computed } from 'vue'
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
        <MaybeIconComponent :name="icon" size="250px" style="margin: 0 auto; margin-left: 100px; opacity: 0.9;" />
      </div>
    </div>
    <div class="flex flex-row absolute bottom-10 text-left items-start">
      <img v-if="siteLogo" :src="siteLogo" height="30">
      <div v-else-if="siteName" style="font-size: 25px;" class="font-bold">
        {{ siteName }}
      </div>
      <div v-else class="flex flex-row items-center space-x-5">
        <div class="flex flex-row items-end gap-1.5 font-bold text-2xl text-white font-title">
          <svg height="25" width="25" class="d-inline-block mb-2px mr-2" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path fill="#00DC82" d="M62.3,-53.9C74.4,-34.5,73.5,-9,67.1,13.8C60.6,36.5,48.7,56.5,30.7,66.1C12.7,75.7,-11.4,74.8,-31.6,65.2C-51.8,55.7,-67.9,37.4,-73.8,15.7C-79.6,-6,-75.1,-31.2,-61.1,-51C-47.1,-70.9,-23.6,-85.4,0.8,-86C25.1,-86.7,50.2,-73.4,62.3,-53.9Z" transform="translate(100 100)" />
          </svg>
          <span>Nuxt</span><span class="sm:text-primary-500 dark:sm:text-primary-400 ml-2">SEO</span>
        </div>
        <div class="opacity-75 flex flex-row items-end gap-1.5 font-bold text-2xl text-white font-title px-5">
          •
        </div>
        <div class="flex flex-row items-end gap-1.5 font-bold text-2xl text-white font-title">
          OG Image
        </div>
      </div>
    </div>
  </div>
</template>
