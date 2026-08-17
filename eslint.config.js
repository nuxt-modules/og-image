import antfu from '@antfu/eslint-config'
import harlanzw from 'eslint-plugin-harlanzw'

export default antfu(
  {},
  ...harlanzw({
    base: { type: 'app', ignores: ['.claude'] },
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
