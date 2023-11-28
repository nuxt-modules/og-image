import { joinURL } from 'ufo'

export function getOgImagePath(pagePath: string, extension = 'png') {
  return joinURL('/__og-image__/image', pagePath, `og.${extension}`)
}

export function isInternalRoute(path: string) {
  const lastSegment = path.split('/').pop() || path
  return lastSegment.includes('.') || path.startsWith('/__') || path.startsWith('@')
}
