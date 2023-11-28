<script setup lang="ts">
import { computed, defineComponent, resolveComponent } from 'vue'
import { useSiteConfig } from '#imports'

// inherited attrs can mess up the satori parser
defineOptions({
  inheritAttrs: false,
})

// convert to typescript props
const props = withDefaults(defineProps<{
  colorMode?: 'dark' | 'light'
  title?: string
  description?: string
  icon?: string | boolean
  siteName?: string
  siteLogo?: string
  theme?: string
}>(), {
  theme: '#00dc82',
  colorMode: 'dark',
  title: 'title',
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
      background: props.colorMode === 'dark' ? 'rgba(5, 5, 5,1)' : 'rgb(255, 255, 255)',
    },
  }
})

const backgroundFlareAttrs = computed(() => {
  // we want to make a
  // const isBackgroundTw = props.background?.startsWith('bg-')
  // need to convert hex to RGB, i.e #123123 -> 18, 49, 35
  const rgbColor = props.theme
    .replace('#', '')
    .match(/.{1,2}/g)
    ?.map(v => Number.parseInt(v, 16))
    .join(', ')
  return {
    style: {
      display: 'flex',
      position: 'absolute',
      right: '-100%',
      top: '0%',
      width: '200%',
      height: '200%',
      backgroundImage: `radial-gradient(circle, rgba(${rgbColor}, 0.5) 0%,  ${props.colorMode === 'dark' ? 'rgba(5, 5, 5,0.3)' : 'rgba(255, 255, 255, 0.7)'} 50%, ${props.colorMode === 'dark' ? 'rgba(5, 5, 5,0)' : 'rgba(255, 255, 255, 0)'} 70%)`,
    },
  }
})

const containerAttrs = computed(() => {
  const classes = [
    'w-full',
    'h-full',
    'flex',
    'justify-between',
    props.colorMode === 'dark' ? 'text-gray-100' : 'text-gray-900',
    'relative',
  ]
  const styles: Record<string, any> = {
    padding: '5rem',
  }
  return { class: classes, style: styles }
})

const titleAttrs = computed(() => {
  return { style: {
    fontWeight: 'bold',
    marginBottom: '50px',
    fontSize: '75px',
    maxWidth: !props.icon ? '70%' : undefined,
  } }
})

const descriptionAttrs = computed(() => {
  return { style: {
    fontSize: '35px',
    lineHeight: `1.5rem`,
    opacity: '0.8',
  } }
})

const siteConfig = useSiteConfig()
const siteName = computed(() => {
  return props.siteName || siteConfig.name
})
const siteLogo = computed(() => {
  return props.siteLogo || siteConfig.logo
})

const runtimeConfig = useRuntimeConfig()['nuxt-og-image']

const IconComponent = runtimeConfig.hasNuxtIcon
  ? resolveComponent('Icon')
  : defineComponent({
    render() {
      return h('div', this.$slots.default)
    },
  })
if (typeof props.icon === 'string' && !runtimeConfig.hasNuxtIcon && process.dev) {
  console.warn('Please install `nuxt-icon` to use icons with the fallback OG Image component.')
  // eslint-disable-next-line no-console
  console.log('\nnpm add -D nuxt-icon\n')
  // create simple div renderer component
}
</script>

<template>
  <div v-bind="backgroundAttrs" />
  <div v-bind="backgroundFlareAttrs" />
  <div v-bind="containerAttrs">
    <div class="flex flex-row justify-between items-center">
      <div class="flex flex-col w-full" :style="icon ? { width: '65%' } : {}">
        <div v-bind="titleAttrs">
          {{ title || 'Null Title' }}
        </div>
        <div v-if="description" v-bind="descriptionAttrs">
          {{ description }}
        </div>
      </div>
      <div v-if="icon" style="width: 30%;" class="flex justify-end">
        <IconComponent :name="icon" size="250px" style="margin: 0 auto 0 100px;opacity: 0.9;" />
      </div>
    </div>
    <div class="flex flex-row justify-center items-center text-left w-full">
      <img v-if="siteLogo" :src="siteLogo" height="30">
      <template v-else>
        <svg height="50" width="50" class="mr-3" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path :fill="theme.includes('#') ? theme : `#${theme}`" d="M62.3,-53.9C74.4,-34.5,73.5,-9,67.1,13.8C60.6,36.5,48.7,56.5,30.7,66.1C12.7,75.7,-11.4,74.8,-31.6,65.2C-51.8,55.7,-67.9,37.4,-73.8,15.7C-79.6,-6,-75.1,-31.2,-61.1,-51C-47.1,-70.9,-23.6,-85.4,0.8,-86C25.1,-86.7,50.2,-73.4,62.3,-53.9Z" transform="translate(100 100)" />
        </svg>
        <div v-if="siteName" style="font-size: 25px;" class="font-bold">
          {{ siteName }}
        </div>
      </template>
    </div>
  </div>
</template>
