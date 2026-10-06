import { defineNitroPlugin } from '#nuxtseo/nitro'
import { collectAutoEjectTemplates, ejectCollectedTemplates } from '../util/auto-eject-lifecycle'

// Nitro 2 copies templates after responding, since a new directory restarts development.
export default defineNitroPlugin((nitro) => {
  if (!import.meta.dev)
    return
  nitro.hooks.hook('render:html', (html, { event }) => collectAutoEjectTemplates(html, event))
  nitro.hooks.hook('afterResponse', ejectCollectedTemplates)
})
