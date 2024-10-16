import type { MaybeRef } from '@vueuse/core'
import type { BundledLanguage, Highlighter } from 'shiki'
import { createHighlighter } from 'shiki'
import { computed, ref, toValue } from 'vue'
import { devtools } from './rpc'

export const shiki = ref<Highlighter>()

export async function loadShiki() {
  // Only loading when needed
  shiki.value = await createHighlighter({
    themes: [
      'vitesse-dark',
      'vitesse-light',
    ],
    langs: [
      'html',
      'json',
    ],
  })
  return shiki.value
}

export function renderCodeHighlight(code: MaybeRef<string>, lang: BundledLanguage) {
  return computed(() => {
    const colorMode = devtools.value?.colorMode || 'light'
    return shiki.value!.codeToHtml(toValue(code) || '', {
      lang,
      theme: colorMode === 'dark' ? 'vitesse-dark' : 'vitesse-light',
    }) || ''
  })
}
