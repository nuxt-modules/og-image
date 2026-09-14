import type { StringFilter, UnpluginOptions } from 'unplugin'

type Pattern = string | RegExp

export interface TransformOutput {
  code: string
  map?: unknown
}

/**
 * unplugin treats a bare string `id` pattern as a glob and a bare string `code` pattern
 * as a substring. This helper only implements the substring form, so a glob fails loudly
 * instead of matching the wrong ids.
 */
function testPattern(pattern: Pattern, value: string, kind: 'id' | 'code'): boolean {
  if (typeof pattern !== 'string')
    return pattern.test(value)
  if (kind === 'id')
    throw new TypeError(`glob id filters are not supported by this helper: ${pattern}`)
  return value.includes(pattern)
}

function testFilter(filter: StringFilter | undefined, value: string, kind: 'id' | 'code'): boolean {
  if (!filter)
    return true
  if (typeof filter === 'string' || filter instanceof RegExp || Array.isArray(filter))
    return [filter].flat().some(pattern => testPattern(pattern, value, kind))
  const exclude = filter.exclude ? [filter.exclude].flat() : []
  if (exclude.some(pattern => testPattern(pattern, value, kind)))
    return false
  const include = filter.include ? [filter.include].flat() : undefined
  return !include || include.some(pattern => testPattern(pattern, value, kind))
}

/**
 * Run an unplugin `transform` hook the way a bundler does: apply the declared filter
 * first, then the handler. Returns undefined when the filter rejects the module, which
 * is what a bundler does by never calling the hook.
 */
export async function runTransform(plugin: UnpluginOptions, code: string, id: string): Promise<TransformOutput | undefined> {
  const hook = plugin.transform
  if (!hook)
    return undefined
  let result
  if (typeof hook === 'function') {
    result = await hook.call({} as never, code, id)
  }
  else {
    if (!testFilter(hook.filter?.id, id, 'id'))
      return undefined
    if (!testFilter(hook.filter?.code, code, 'code'))
      return undefined
    result = await hook.handler.call({} as never, code, id)
  }
  if (!result)
    return undefined
  return typeof result === 'string' ? { code: result } : result as TransformOutput
}
