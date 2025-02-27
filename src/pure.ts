import type { InputFontConfig, ResolvedFontConfig } from './runtime/types'

// duplicate of runtime/pure.ts
export function normaliseFontInput(fonts: InputFontConfig[]): ResolvedFontConfig[] {
  return fonts.map((f) => {
    if (typeof f === 'string') {
      const vals = f.split(':')
      const includesStyle = vals.length === 3
      let name, weight, style
      if (includesStyle) {
        name = vals[0]
        style = vals[1]
        weight = vals[2]
      }
      else {
        name = vals[0]
        weight = vals[1]
      }
      return <ResolvedFontConfig> {
        cacheKey: f,
        name,
        weight: weight || 400,
        style: style || 'normal',
        path: undefined,
      }
    }
    return <ResolvedFontConfig> {
      cacheKey: f.key || `${f.name}:${f.style}:${f.weight}`,
      style: 'normal',
      weight: 400,
      ...f,
    }
  })
}
