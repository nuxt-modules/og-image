import plugin from 'tailwindcss/plugin'

export default plugin(({ addUtilities }) => {
  addUtilities({
    '.og-plugin-bg': {
      'background-color': '#9333ea',
    },
  })
})
