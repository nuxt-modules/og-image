const RE_QUOT = /&quot;/g
const RE_APOS_DEC = /&#39;/g
const RE_APOS_HEX = /&#x27;/g
const RE_LT = /&lt;/g
const RE_GT = /&gt;/g
const RE_CENT = /&cent;/g
const RE_POUND = /&pound;/g
const RE_YEN = /&yen;/g
const RE_EURO = /&euro;/g
const RE_COPY = /&copy;/g
const RE_REG = /&reg;/g
const RE_SLASH_HEX = /&#x2F;/g
const RE_DEC_ENTITY = /&#(\d+);/g
const RE_AMP = /&amp;/g

export function htmlDecodeQuotes(html: string) {
  return html.replace(RE_QUOT, '"')
    .replace(RE_APOS_DEC, '\'')
    .replace(RE_APOS_HEX, '\'')
}

export function decodeHtml(html: string) {
  return html.replace(RE_LT, '<')
    .replace(RE_GT, '>')
    // money symbols
    .replace(RE_CENT, '¢')
    .replace(RE_POUND, '£')
    .replace(RE_YEN, '¥')
    .replace(RE_EURO, '€')
    .replace(RE_COPY, '©')
    .replace(RE_REG, '®')
    .replace(RE_QUOT, '"')
    .replace(RE_APOS_DEC, '\'')
    .replace(RE_APOS_HEX, '\'')
    .replace(RE_SLASH_HEX, '/')
    .replace(RE_DEC_ENTITY, (full, int) => {
      return String.fromCharCode(Number.parseInt(int))
    })
    .replace(RE_AMP, '&')
}
export function decodeObjectHtmlEntities(obj: Record<string, string | any>) {
  Object.entries(obj).forEach(([key, value]) => {
    // unescape all html tokens
    if (typeof value === 'string')
      obj[key] = decodeHtml(value)
  })
  return obj
}
