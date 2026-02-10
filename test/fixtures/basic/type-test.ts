/**
 * E2E type-test file — verified by vue-tsc via the unit test.
 * Each line exercises a real defineOgImage call against the generated types.
 */
import { defineOgImage } from '#imports'

// App component with typed props (CustomFonts.satori.vue has: colorMode, title, description)
defineOgImage('CustomFonts', { title: 'Hello', description: 'World' })

// Dot-notation variant
defineOgImage('CustomFonts.satori', { colorMode: 'dark' })

// Community component
defineOgImage('NuxtSeo.satori', { title: 'Test' })

// Bare shorthand (unambiguous component)
defineOgImage('Creal', { title: 'Test' })

// Component with no typed props (runtime defineProps)
defineOgImage('CalcTest', {})

// Getter function for reactive props
defineOgImage('CustomFonts', { title: () => 'reactive' })
