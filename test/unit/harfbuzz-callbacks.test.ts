import { describe, expect, it, vi } from 'vitest'
import { createHarfBuzzCallbackModule } from '../../src/build/harfbuzz'

describe('harfBuzz callback modules', () => {
  it.each([
    ['vi', [42], undefined],
    ['iiiii', [1, 2, 3, 4], 17],
    ['viiiffi', [1, 2, 3, 1.5, 2.5, 4], undefined],
    ['ippip', [1, 2, 3, 4], 17],
  ] as const)('forwards %s arguments and its return value', async (signature, args, result) => {
    const callback = vi.fn(() => result)
    const module = await WebAssembly.compile(createHarfBuzzCallbackModule(signature))
    const instance = new WebAssembly.Instance(module, { e: { f: callback } })
    const call = instance.exports.f as (...args: number[]) => number | undefined
    expect(call(...args)).toBe(result)
    expect(callback).toHaveBeenCalledWith(...args)
  })
})
