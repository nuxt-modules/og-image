import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineOgImageScreenshot } from '../../src/runtime/app/composables/defineOgImageScreenshot'

const state = vi.hoisted(() => ({ browserEnabled: false }))
const render = vi.hoisted(() => vi.fn(() => ['/screenshot.jpeg']))
vi.mock('#app', () => ({
  createError: ({ statusMessage }: { statusMessage: string }) => new Error(statusMessage),
  useRouter: () => ({ currentRoute: { value: { path: '/article' } } }),
}))
vi.mock('../../src/runtime/app/utils', () => ({ useOgImageRuntimeConfig: () => state }))
vi.mock('../../src/runtime/app/composables/_defineOgImageRaw', () => ({ defineOgImageRaw: render }))

beforeEach(() => {
  state.browserEnabled = false
  render.mockClear()
})

describe('defineOgImageScreenshot opt-in', () => {
  it('explains how to enable screenshots before generating metadata', () => {
    expect(() => defineOgImageScreenshot()).toThrow('Set ogImage.browser to true')
    expect(render).not.toHaveBeenCalled()
  })

  it('generates screenshot metadata when enabled', () => {
    state.browserEnabled = true
    expect(defineOgImageScreenshot({ width: 640, selector: 'main' })).toEqual(['/screenshot.jpeg'])
    expect(render).toHaveBeenCalledWith(expect.objectContaining({
      renderer: 'browser',
      component: 'PageScreenshot',
      width: 640,
      screenshot: expect.objectContaining({ selector: 'main' }),
    }))
  })
})
