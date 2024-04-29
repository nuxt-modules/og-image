import type { InputFontConfig, ResolvedFontConfig } from './runtime/types'

// duplicate of runtime/pure.ts
export function normaliseFontInput(fonts: InputFontConfig[]): ResolvedFontConfig[] {
  return fonts.map((f) => {
    if (typeof f === 'string') {
      const [name, weight] = f.split(':')
      return <ResolvedFontConfig> {
        cacheKey: f,
        name,
        weight: weight || 400,
        style: 'normal',
        path: undefined,
      }
    }
    return <ResolvedFontConfig> {
      cacheKey: f.key || `${f.name}:${f.weight}`,
      style: 'normal',
      weight: 400,
      ...f,
    }
  })
}
