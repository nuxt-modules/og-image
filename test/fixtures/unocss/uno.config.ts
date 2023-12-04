import colors from 'tailwindcss/colors'
import { defineConfig } from 'unocss'

export default defineConfig({
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
