export function htmlDecodeQuotes(html: string) {
  return html.replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&#x27;/g, '\'')
}

export function decodeHtml(html: string) {
  return html.replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    // money symbols
    .replace(/&cent;/g, '¢')
    .replace(/&pound;/g, '£')
    .replace(/&yen;/g, '¥')
    .replace(/&euro;/g, '€')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&#x27;/g, '\'')
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (full, int) => {
      return String.fromCharCode(Number.parseInt(int))
    })
}
export function decodeObjectHtmlEntities(obj: Record<string, string | any>) {
  Object.entries(obj).forEach(([key, value]) => {
    // unescape all html tokens
    if (typeof value === 'string')
      obj[key] = decodeHtml(value)
  })
  return obj
}
