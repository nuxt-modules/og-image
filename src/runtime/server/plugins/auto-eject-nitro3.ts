import type { AutoEjectEvent, AutoEjectHtml } from '../util/auto-eject-lifecycle'
import { defineNitroPlugin } from '#nuxtseo/nitro'
import { collectAutoEjectTemplates, ejectCollectedTemplates } from '../util/auto-eject-lifecycle'

interface AutoEjectHooks {
  hook: {
    (name: 'render:html', callback: (html: AutoEjectHtml, context: { event: AutoEjectEvent }) => void): unknown
    (name: 'response', callback: (response: Response, event: AutoEjectEvent) => void): unknown
  }
}

// Nitro 3 exposes its final Response before transmission. Rendering has already finished.
export default defineNitroPlugin((nitro) => {
  if (!import.meta.dev)
    return
  const hooks = nitro.hooks as unknown as AutoEjectHooks
  hooks.hook('render:html', (html, { event }) => collectAutoEjectTemplates(html, event))
  hooks.hook('response', (_response, event) => ejectCollectedTemplates(event))
})
