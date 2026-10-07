import { expect, it, vi } from 'vitest'
import { getOgImageOrigin } from '../../src/runtime/server/util/origin'

vi.mock('#site-config/server/composables', () => ({
  getNitroOrigin: (event: { req?: Request, context: { siteConfigNitroOrigin: string } }) => event.req
    ? new URL(event.req.url).origin
    : event.context.siteConfigNitroOrigin,
}))

it('uses the captured origin from renderer context without reading legacy request fields', () => {
  const event = {
    context: { siteConfigNitroOrigin: 'https://forwarded.example.com' },
    get req(): never {
      throw new Error('Renderer origin must use the captured request context.')
    },
  }
  expect(getOgImageOrigin(event)).toBe('https://forwarded.example.com')
})
