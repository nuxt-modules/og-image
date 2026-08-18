import antfu from '@antfu/eslint-config'
import harlanzw from 'eslint-plugin-harlanzw'

export default antfu(
  // og-image lints its playground on purpose, so the shared ignore set is off and
  // this repo keeps its own list. A global ignore cannot be undone downstream.
  { ignores: ['.claude'] },
  ...harlanzw({
    base: { type: 'app', ignores: false },
    link: true,
    nuxt: true,
    vue: true,
    content: true,
  }),
  {
    rules: {
      'harlanzw/link-no-underscores': 'off',
      'harlanzw/link-trailing-slash': 'off',
      'harlanzw/link-lowercase': 'off',
    },
  },
)
