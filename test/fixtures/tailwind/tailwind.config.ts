import colors from 'tailwindcss/colors'
import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  theme: {
    extend: {
      fontSize: {
        'mega-big': '100px',
      },
      colors: {
        base: colors.white,
        primary: colors.green,
      },
    },
  },
}
