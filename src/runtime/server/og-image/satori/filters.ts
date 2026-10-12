export function resolveSvgFilters(svg: string): string {
  // Resvg limits the SVG saturate primitive to one. An explicit matrix preserves CSS saturation above one.
  return svg.replace(/<feColorMatrix\s[^>]*type="saturate"\s+values="([^"]+)"[^>]*>/g, (filter, value: string) => {
    const saturation = Number(value)
    if (!Number.isFinite(saturation) || saturation <= 1)
      return filter
    const matrix = [
      [0.213 + 0.787 * saturation, 0.715 - 0.715 * saturation, 0.072 - 0.072 * saturation, 0, 0],
      [0.213 - 0.213 * saturation, 0.715 + 0.285 * saturation, 0.072 - 0.072 * saturation, 0, 0],
      [0.213 - 0.213 * saturation, 0.715 - 0.715 * saturation, 0.072 + 0.928 * saturation, 0, 0],
      [0, 0, 0, 1, 0],
    ].flat()
    return filter.replace(`type="saturate" values="${value}"`, `type="matrix" values="${matrix.join(' ')}"`)
  })
}
