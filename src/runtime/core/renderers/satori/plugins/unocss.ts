import { createGenerator } from '@unocss/core'
import presetWind from '@unocss/preset-wind'
import type { VNode } from '../../../../types'
import { defineSatoriTransformer } from '../utils'
import { theme } from '#nuxt-og-image/unocss-config.mjs'

const uno = createGenerator({ theme }, {
  presets: [
    presetWind(),
  ],
})

// convert classes to inline style using unocss, provides more robust API than satori
export default defineSatoriTransformer({
  filter: (node: VNode) => !!node.props?.class,
  transform: async (node: VNode) => {
    const classes: string = node.props.class || ''
    // normalise the styles
    const styles = node.props.style as Record<string, string> || {}

    const replacedClasses = new Set()
    for (const token of classes.split(' ').filter(c => c.trim())) {
      const parsedToken = await uno.parseToken(token)
      if (parsedToken) {
        const inlineStyles = parsedToken[0][2].split(';').filter(s => !!s?.trim())
        const vars: Record<string, string> = {}
        inlineStyles.filter(s => s.startsWith('--'))
          .forEach((s) => {
            const [key, value] = s.split(':')
            vars[key] = value
          })
        inlineStyles.filter(s => !s.startsWith('--'))
          .forEach((s) => {
            const [key, value] = s.split(':')
            const camelCasedKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
            // we need to replace any occurances of a var key with the var values, avoid replacing existing inline styles
            if (!styles[camelCasedKey])
              styles[camelCasedKey] = value.replace(/var\((.*?)\)/g, (_, k) => vars[k.trim()])
          })
        replacedClasses.add(token)
      }
    }
    node.props.class = classes.split(' ').filter(c => !replacedClasses.has(c)).join(' ')
    node.props.tw = classes.split(' ').filter(c => !replacedClasses.has(c)).join(' ')
    node.props.style = styles
  },
})
