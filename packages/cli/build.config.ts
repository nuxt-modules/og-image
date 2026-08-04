import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: false,
  entries: [
    { input: 'src/cli', name: 'cli' },
  ],
  rollup: {
    emitCJS: false,
  },
})
