import type { H3Event } from '#nuxtseo/h3'
import { getQuery, withQuery } from 'ufo'

/**
 * Parse query parameters from the event path without relying on the H3 event
 * implementation. Nitro adapters can pass an H3 v1 event to bundled H3 v2
 * utilities, where getQuery(event) treats the relative req.url as absolute.
 */
export function getEventQuery(event: H3Event) {
  return getQuery(event.path)
}

export function isQueryRecord(value: unknown): value is Record<string, any> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function withPageQuery(path: string, query: unknown): string {
  return isQueryRecord(query) && Object.keys(query).length > 0
    ? withQuery(path, query)
    : path
}
