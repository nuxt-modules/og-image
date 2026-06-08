import { splitCssDeclarations } from '../utils/css'

const RE_KEBAB_SEGMENT = /-([a-z])/g
const RE_CSS_QUOTES = /^['"](.+)['"]$/
const RE_IMPORTANT = /\s*!important\s*$/

// Single-pass decode of the HTML entities that survive the ultrahtml
// attribute-value parser. Matching all entities in one regex avoids the
// double-unescape pitfall where `&amp;quot;` (a literal `&quot;`) would
// otherwise become `"` after sequential `&amp;` -> `&` then `&quot;` -> `"`.
const RE_HTML_ENTITY = /&(?:amp|quot|#39|#x27);/g
const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': '\'',
  '&#x27;': '\'',
}

function camelCase(str: string): string {
  return str.replace(RE_KEBAB_SEGMENT, (_, c) => c.toUpperCase())
}

function decodeHtmlEntities(value: string): string {
  return value.replace(RE_HTML_ENTITY, m => HTML_ENTITY_MAP[m] ?? m)
}

/**
 * Parse an inline `style="..."` attribute value into a camelCase property map
 * suitable for handing to Satori / Takumi.
 *
 * Kept in a leaf module (no nitro / h3 imports) so it can be unit-tested
 * directly without pulling the full runtime bundle.
 */
export function parseStyleAttr(style: string | null | undefined): Record<string, any> | undefined {
  if (!style)
    return undefined
  const result: Record<string, any> = {}
  // Decode `&amp;`, `&quot;`, `&#39;`, `&#x27;` so quoted CSS strings
  // (e.g. `url("data:...")`, `font-family: 'Inter'`) and `&`-containing URLs
  // reach the renderer in their decoded form.
  for (const decl of splitCssDeclarations(decodeHtmlEntities(style))) {
    const colonIdx = decl.indexOf(':')
    if (colonIdx === -1)
      continue
    const prop = decl.slice(0, colonIdx).trim()
    const val = decl.slice(colonIdx + 1).trim()
    if (prop && val) {
      // Strip !important; Satori/Takumi don't support CSS specificity.
      // Strip CSS quotes from font-family; Satori matches font names as plain
      // strings (e.g. `JetBrains Mono`), not CSS-quoted values (`'JetBrains Mono'`).
      const cleanVal = val.replace(RE_IMPORTANT, '')
      result[camelCase(prop)] = prop === 'font-family'
        ? cleanVal.replace(RE_CSS_QUOTES, '$1')
        : cleanVal
    }
  }
  return Object.keys(result).length ? result : undefined
}
