import { defineNuxtPlugin } from '#imports'

export default defineNuxtPlugin(() => {
  if (import.meta.hot) {
    import.meta.hot.on('nuxt-og-image:refresh', () => {
      window.dispatchEvent(new CustomEvent('nuxt-og-image:refresh'))
    })
    import.meta.hot.on('nuxt-og-image:refresh-global', () => {
      window.dispatchEvent(new CustomEvent('nuxt-og-image:refresh-global'))
    })
  }
})
