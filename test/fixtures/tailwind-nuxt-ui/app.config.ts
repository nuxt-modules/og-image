// Uses plain export (not defineAppConfig) because @nuxt/test-utils Nitro build
// doesn't transform the defineAppConfig auto-import in server bundles.
export default ({
  ui: {
    colors: {
      primary: 'indigo',
      secondary: 'emerald',
      success: 'green',
      info: 'sky',
      warning: 'amber',
      error: 'rose',
      neutral: 'zinc',
    },
  },
})
