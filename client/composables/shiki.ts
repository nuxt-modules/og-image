import type { HighlighterCore } from 'shiki'
import type { Ref } from 'vue'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { computed, ref, toValue } from 'vue'

export const shiki = ref<HighlighterCore>()

export async function loadShiki() {
  shiki.value = await createHighlighterCore({
    themes: [
      import('@shikijs/themes/vitesse-light'),
      import('@shikijs/themes/vitesse-dark'),
    ],
    langs: [
      import('@shikijs/langs/xml'),
      import('@shikijs/langs/json'),
      import('@shikijs/langs/js'),
    ],
    engine: createJavaScriptRegexEngine(),
  })

  return shiki.value
}

export function renderCodeHighlight(code: Ref<string> | string, lang: 'json' | 'xml' | 'js') {
  return computed(() => {
    return shiki.value!.codeToHtml(toValue(code) || '', {
      lang,
      themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
    }) || ''
  })
}
