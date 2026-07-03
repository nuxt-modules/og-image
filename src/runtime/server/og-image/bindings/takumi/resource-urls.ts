import type { Node } from '@takumi-rs/helpers'

const RE_URL = /url\(\s*(['"]?)(.*?)\1\s*\)/g

function isFetchableResourceUrl(value: unknown): value is string {
  return typeof value === 'string' && (value.startsWith('/') || /^https?:\/\//i.test(value))
}

function collectUrlsFromValue(value: unknown, urls: Set<string>) {
  if (typeof value !== 'string') {
    if (Array.isArray(value)) {
      for (const item of value)
        collectUrlsFromValue(item, urls)
    }
    return
  }

  for (const match of value.matchAll(RE_URL)) {
    const url = match[2]?.trim()
    if (isFetchableResourceUrl(url))
      urls.add(url)
  }
}

function collectStyleUrls(style: unknown, urls: Set<string>) {
  if (!style || typeof style !== 'object')
    return

  for (const value of Object.values(style))
    collectUrlsFromValue(value, urls)
}

function collectNodeUrls(node: Node, urls: Set<string>) {
  collectStyleUrls(node.style, urls)
  collectStyleUrls(node.preset, urls)
  collectUrlsFromValue(node.tw, urls)

  if (node.type === 'image' && isFetchableResourceUrl(node.src))
    urls.add(node.src)

  if (node.type === 'container') {
    for (const child of node.children || [])
      collectNodeUrls(child, urls)
  }
}

export function extractResourceUrls(nodes: Node | Node[]): string[] {
  const urls = new Set<string>()

  for (const node of Array.isArray(nodes) ? nodes : [nodes])
    collectNodeUrls(node, urls)

  return [...urls]
}
