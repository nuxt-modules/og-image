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
})
