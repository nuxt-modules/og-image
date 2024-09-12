import type { BuiltinLanguage, Highlighter } from 'shiki'
import { useColorMode } from '#imports'
import { getHighlighter } from 'shiki'
import { ref } from 'vue'

export const shiki = ref<Highlighter>()

// TODO: Only loading when needed
getHighlighter({
  themes: [
    'vitesse-dark',
    'vitesse-light',
  ],
  langs: [
    'html',
    'json',
  ],
}).then((i) => { shiki.value = i })
const mode = useColorMode()
export function highlight(code: string, lang: BuiltinLanguage) {
  if (!shiki.value)
    return code
  return shiki.value.codeToHtml(code, {
    lang,
    theme: mode.value === 'dark' ? 'vitesse-dark' : 'vitesse-light',
  })
}
