import type { RequestEvent } from 'nuxt/server'
import type { OgImageComponent, OgImageOptionsInternal } from '../../types'
import { parse } from 'devalue'
import { useOgImageRuntimeConfig } from '../utils'
import { autoEjectCommunityTemplate } from './auto-eject'
import { normaliseOptions } from './options'

export interface AutoEjectEvent { context: RequestEvent['context'] & { _ogImageAutoEject?: OgImageComponent[] } }
export interface AutoEjectHtml { head: string[], bodyAppend: string[] }
const PAYLOAD_REGEX = /<script.+id="nuxt-og-image-options"[^>]*>(.+?)<\/script>/

export function collectAutoEjectTemplates(html: AutoEjectHtml, event: AutoEjectEvent): void {
  const payload = [...html.head, ...html.bodyAppend].join('\n').match(PAYLOAD_REGEX)?.[1]
  if (!payload)
    return
  for (const options of parse(payload) as OgImageOptionsInternal[]) {
    if (!options?.component)
      continue
    const normalised = (() => {
      try {
        return normaliseOptions({ ...options })
      }
      catch {
        // The image route reports unknown component names. No template exists to copy.
        return null
      }
    })()
    if (normalised?.component?.category === 'community')
      (event.context._ogImageAutoEject ||= []).push(normalised.component)
  }
}

export function ejectCollectedTemplates(event: AutoEjectEvent): void {
  const components: OgImageComponent[] | undefined = event.context._ogImageAutoEject
  if (!components?.length)
    return
  const runtimeConfig = useOgImageRuntimeConfig(event)
  for (const component of components)
    autoEjectCommunityTemplate(component, runtimeConfig)
}
