import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { extractTw4Metadata } from '../../src/build/css/providers/tw4'

describe('tw4 font vars extraction', () => {
  it('extracts user-defined @theme font vars', async () => {
    const cssPath = resolve(__dirname, '../fixtures/multi-font-families/assets/css/main.css')
    const metadata = await extractTw4Metadata({ cssPath })
    // User-defined @theme vars should be extracted despite TW4 tree-shaking
    expect(metadata.fontVars['font-local-sans']).toContain('LocalSans')
    expect(metadata.fontVars['font-local-serif']).toContain('LocalSerif')
    expect(metadata.fontVars['font-display']).toContain('Lobster')
    expect(metadata.fontVars['font-variable']).toContain('Nunito Sans')
    expect(metadata.fontVars['font-serif']).toContain('Playfair Display')
    expect(metadata.fontVars['font-mono']).toContain('JetBrains Mono')
    // TW4 default
    expect(metadata.fontVars['font-sans']).toBeDefined()
  })
})
