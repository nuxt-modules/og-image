import { joinURL } from 'ufo'

export function getOgImagePath(pagePath: string, extension = 'png') {
  return joinURL('/__og-image__/image', pagePath, `og.${extension}`)
}
