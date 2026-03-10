import antfu from '@antfu/eslint-config'
import harlanzw from 'eslint-plugin-harlanzw'

export default antfu({
  ignores: ['.claude'],
  rules: {
    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
    'no-use-before-define': 'off',
  },
}, ...harlanzw({ link: true, nuxt: true, vue: true, content: true }), {
  files: ['test/**/*.ts', 'test/**/*.mjs'],
  rules: {
    'e18e/prefer-static-regex': 'off',
  },
}, {
  rules: {
    'harlanzw/link-no-underscores': 'off',
    'harlanzw/link-trailing-slash': 'off',
    'harlanzw/link-lowercase': 'off',
  },
})
