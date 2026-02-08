import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: ['.claude'],
  rules: {
    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
    'no-use-before-define': 'off',
  },
})
