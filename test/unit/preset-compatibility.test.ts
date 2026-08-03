import { describe, expect, it } from 'vitest'
import { getPresetNitroPresetCompatibility, NodeRuntime, RuntimeCompatibility } from '../../src/compatibility'

describe('preset compatibility', () => {
  it('node-cluster resolves to NodeRuntime', () => {
    expect(RuntimeCompatibility['node-cluster']).toBe(NodeRuntime)
  })

  it('getPresetNitroPresetCompatibility resolves node-cluster', () => {
    const compat = getPresetNitroPresetCompatibility('node-cluster')
    expect(compat).toBe(NodeRuntime)
  })

  it('node_cluster underscore variant resolves after normalization', () => {
    // resolveNitroPreset does .replace('_', '-')
    const normalized = 'node_cluster'.replace('_', '-')
    expect(RuntimeCompatibility[normalized]).toBe(NodeRuntime)
  })

  it.each([
    'cloudflare',
    'cloudflare-pages',
    'cloudflare-pages-static',
    'cloudflare-module',
    'cloudflare-durable',
    'vercel-edge',
    'netlify-edge',
  ] as const)('%s excludes worker thread bindings', (preset) => {
    expect(RuntimeCompatibility[preset]?.resvg).not.toBe('node-dev')
    expect(RuntimeCompatibility[preset]?.takumi).not.toBe('node-dev')
  })
})
