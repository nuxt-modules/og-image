import colors from 'tailwindcss/colors'
import { defineConfig, presetUno } from 'unocss'

export default defineConfig({
  presets: [presetUno()],
  theme: {
    fontSize: {
      'mega-big': '100px',
    },
    colors: {
      'base': colors.white,
      'primary': colors.green,
      'brand': '#f29101',
      'accent': '#8b5cf6',
      'highlight': '#ec4899',
      'ocean': '#0ea5e9',
      'forest': '#22c55e',
      'sunset': '#f97316',
      'surface': '#1e293b',
      // CSS var-referencing colors (like npmx.dev)
      'bg': {
        DEFAULT: 'var(--bg)',
        subtle: 'var(--bg-subtle)',
      },
      'fg': {
        DEFAULT: 'var(--fg)',
        muted: 'var(--fg-muted)',
      },
      'theme-accent': 'var(--accent)',
    },
  },
})
