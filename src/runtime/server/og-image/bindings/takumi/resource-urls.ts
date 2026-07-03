import type { Node } from '@takumi-rs/helpers'

function isWhitespace(char: string | undefined) {
  return char === ' ' || char === '\n' || char === '\t' || char === '\r' || char === '\f'
}

function findUrlFunction(value: string, start: number) {
  for (let i = start; i <= value.length - 4; i++) {
    if (
      (value[i] === 'u' || value[i] === 'U')
      && (value[i + 1] === 'r' || value[i + 1] === 'R')
      && (value[i + 2] === 'l' || value[i + 2] === 'L')
      && value[i + 3] === '('
    ) {
      return i
    }
  }
  return -1
}

function readQuotedUrl(value: string, start: number, quote: string) {
  let i = start + 1
  while (i < value.length) {
    const char = value[i]
    if (char === '\\') {
      i += 2
      continue
    }
    if (char === quote) {
      const url = value.slice(start + 1, i)
      i++
      while (isWhitespace(value[i]))
        i++
      return value[i] === ')' ? { end: i + 1, url } : null
    }
    i++
  }
  return null
}

function readUnquotedUrl(value: string, start: number) {
  const end = value.indexOf(')', start)
  return end === -1 ? null : { end: end + 1, url: value.slice(start, end) }
}

function collectCssUrls(value: string, urls: Set<string>) {
  let index = 0
  while (index < value.length) {
    const start = findUrlFunction(value, index)
    if (start === -1)
      return

    let urlStart = start + 4
    while (isWhitespace(value[urlStart]))
      urlStart++

    const quote = value[urlStart]
    const result = quote === '\'' || quote === '"'
      ? readQuotedUrl(value, urlStart, quote)
      : readUnquotedUrl(value, urlStart)

    if (!result) {
      index = start + 4
      continue
    }

    const url = result.url.trim()
    if (isFetchableResourceUrl(url))
      urls.add(url)
    index = result.end
  }
}

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

  collectCssUrls(value, urls)
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
