import * as v from 'valibot'

export function defineOgImageSchema() {
  return v.optional(v.object({
    url: v.optional(v.string()),
    component: v.optional(v.string()),
    props: v.record(v.string(), v.unknown()),
  }))
}
