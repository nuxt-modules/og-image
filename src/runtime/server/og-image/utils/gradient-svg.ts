import { stripGradientColorSpace } from './css'

function parseGradientStops(parts: string[]): string {
  return parts
    .map((stop, i, arr) => {
      // Color hints (e.g. `linear-gradient(red, 50%, blue)`) — skip
      if (!Number.isNaN(Number(stop)))
        return null

      // Split color from optional offset (e.g. `#fff 50%` or `rgba(...) 100%`)
      let color = stop
      let offset = `${Math.round((i / (arr.length - 1)) * 100)}%`
      const lastSpaceIdx = stop.lastIndexOf(' ')
      if (lastSpaceIdx !== -1) {
        const maybeOffset = stop.slice(lastSpaceIdx + 1)
        if (maybeOffset.endsWith('%') && !Number.isNaN(Number.parseFloat(maybeOffset))) {
          color = stop.slice(0, lastSpaceIdx).trim()
          offset = maybeOffset
        }
      }

      let opacity = '1'
      const rgbaMatch = color.match(/rgba?\((.+)\)/)
      if (rgbaMatch) {
        const cParts = rgbaMatch[1]!.split(',').map(p => p.trim())
        if (cParts.length === 4) {
          color = `rgb(${cParts[0]},${cParts[1]},${cParts[2]})`
          opacity = cParts[3]!
        }
      }
      return `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}" />`
    })
    .filter(Boolean)
    .join('')
}

export function linearGradientToSvg(gradient: string, backgroundColor?: string): string | null {
  const match = gradient.match(/linear-gradient\((.*)\)/)
  if (!match)
    return null

  // Strip gradient color interpolation methods (e.g. `in oklab`, `in oklch`)
  // TW4 generates these but image renderers (Satori, Takumi) don't support them.
  const cleanedGradient = stripGradientColorSpace(match[1]!)

  const parts = cleanedGradient.split(/,(?![^(]*\))/).map(p => p.trim())
  let x1 = '0%'
  let y1 = '0%'
  let x2 = '0%'
  let y2 = '100%'
  let stopsStartIdx = 0

  if (parts[0]!.includes('deg')) {
    const angle = Number.parseInt(parts[0]!) || 180
    const rad = (angle - 90) * (Math.PI / 180)
    x1 = `${50 - Math.cos(rad) * 50}%`
    y1 = `${50 - Math.sin(rad) * 50}%`
    x2 = `${50 + Math.cos(rad) * 50}%`
    y2 = `${50 + Math.sin(rad) * 50}%`
    stopsStartIdx = 1
  }
  else if (parts[0]!.includes('to ')) {
    if (parts[0]!.includes('right')) {
      x1 = '0%'
      x2 = '100%'
      y1 = '0%'
      y2 = '0%'
    }
    else if (parts[0]!.includes('bottom')) {
      x1 = '0%'
      x2 = '0%'
      y1 = '0%'
      y2 = '100%'
    }
    stopsStartIdx = 1
  }

  const stops = parseGradientStops(parts.slice(stopsStartIdx))
  const bgRect = backgroundColor ? `<rect width="100" height="100" fill="${backgroundColor}" />` : ''
  return `<svg width="2000" height="2000" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient></defs>${bgRect}<rect width="100" height="100" fill="url(#g)" /></svg>`
}

function parseGradientPositionValue(v: string): number {
  if (v === 'center')
    return 0.5
  if (v === 'left' || v === 'top')
    return 0
  if (v === 'right' || v === 'bottom')
    return 1
  const num = Number.parseFloat(v)
  if (v.endsWith('%'))
    return num / 100
  return num / 100
}

export function radialGradientToSvg(gradient: string, backgroundColor?: string): string | null {
  const match = gradient.match(/radial-gradient\((.*)\)/)
  if (!match)
    return null

  const cleanedGradient = stripGradientColorSpace(match[1]!)
  const parts = cleanedGradient.split(/,(?![^(]*\))/).map(p => p.trim())

  let cx = 0.5
  let cy = 0.5
  let rx = -1
  let ry = -1
  let stopsStartIdx = 0

  const firstPart = parts[0]!

  // Detect if first part is a shape/size/position definition (not a color stop)
  const isDefinition = /\bat\b|^circle\b|^ellipse\b|^closest-|^farthest-/.test(firstPart)
    || (/^\d+(?:\.\d+)?(?:%|px)?\s+\d/.test(firstPart) && !/(?:#|rgb|hsl|transparent|currentcolor)\b/i.test(firstPart))

  if (isDefinition) {
    stopsStartIdx = 1

    // Parse position: "at <x> <y>"
    const atMatch = firstPart.match(/at\s+(?<x>[\w.]+(?:%|px)?)\s+(?<y>[\w.]+(?:%|px)?)/)
    if (atMatch?.groups) {
      cx = parseGradientPositionValue(atMatch.groups.x!)
      cy = parseGradientPositionValue(atMatch.groups.y!)
    }

    // Parse size (strip shape keyword and position for extraction)
    const sizePart = firstPart.replace(/^(?:circle|ellipse)\s*/, '').replace(/\s*at\s+(?:\S.*)?$/, '').trim()
    if (sizePart && !(/^(?:closest|farthest)-(?:side|corner)$/.test(sizePart))) {
      const sizeVals = sizePart.match(/[\d.]+(?:%|px)?/g)
      if (sizeVals && sizeVals.length >= 2) {
        rx = Number.parseFloat(sizeVals[0]!) / 100
        ry = Number.parseFloat(sizeVals[1]!) / 100
      }
      else if (sizeVals && sizeVals.length === 1) {
        rx = ry = Number.parseFloat(sizeVals[0]!) / 100
      }
    }
  }

  // Default: farthest-corner radius from center
  if (rx < 0 || ry < 0) {
    const maxDx = Math.max(cx, 1 - cx)
    const maxDy = Math.max(cy, 1 - cy)
    rx = ry = Math.sqrt(maxDx ** 2 + maxDy ** 2)
  }

  const stops = parseGradientStops(parts.slice(stopsStartIdx))
  const bgRect = backgroundColor ? `<rect width="100" height="100" fill="${backgroundColor}" />` : ''

  // Circular or effectively circular
  if (Math.abs(rx - ry) < 0.001) {
    return `<svg width="2000" height="2000" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g" cx="${cx}" cy="${cy}" r="${rx}" gradientUnits="objectBoundingBox">${stops}</radialGradient></defs>${bgRect}<rect width="100" height="100" fill="url(#g)" /></svg>`
  }

  // Elliptical: use gradientTransform to scale Y axis
  const r = rx
  const scaleY = ry / rx
  const transform = `translate(${cx}, ${cy}) scale(1, ${scaleY}) translate(${-cx}, ${-cy})`
  return `<svg width="2000" height="2000" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="objectBoundingBox" gradientTransform="${transform}">${stops}</radialGradient></defs>${bgRect}<rect width="100" height="100" fill="url(#g)" /></svg>`
}
