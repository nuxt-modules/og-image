import colors from 'tailwindcss/colors'
import { defineConfig, presetUno } from 'unocss'

export default defineConfig({
  presets: [presetUno()],
  theme: {
    fontSize: {
      'mega-big': '100px',
    },
    colors: {
      base: colors.white,
      primary: colors.green,
    },
  },
})
