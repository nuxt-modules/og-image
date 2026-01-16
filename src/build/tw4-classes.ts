import { readFile } from 'node:fs/promises'
import { glob } from 'tinyglobby'

/**
 * Extract all static class names from OG image component files.
 * Handles: class="...", :class="'...'" (static strings in dynamic)
 */
export async function scanComponentClasses(componentDirs: string[], srcDir: string): Promise<Set<string>> {
  const classes = new Set<string>()

  // Build glob patterns for all component directories
  const patterns = componentDirs.map(dir => `**/${dir}/**/*.vue`)

  const files = await glob(patterns, {
    cwd: srcDir,
    absolute: true,
    ignore: ['**/node_modules/**'],
  })

  for (const file of files) {
    const content = await readFile(file, 'utf-8').catch(() => null)
    if (!content)
      continue

    // Extract template section
    const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/)
    if (!templateMatch?.[1])
      continue

    const template = templateMatch[1]

    // Extract static class="..." attributes
    for (const match of template.matchAll(/\bclass="([^"]+)"/g)) {
      const classStr = match[1]
      if (!classStr)
        continue
      // Split by whitespace and add each class
      for (const cls of classStr.split(/\s+/)) {
        if (cls && !cls.includes('{') && !cls.includes('$'))
          classes.add(cls)
      }
    }

    // Extract static classes from :class="'...'" or :class="`...`"
    // This catches simple static strings in dynamic bindings
    for (const match of template.matchAll(/:class="['`]([^'`]+)['`]"/g)) {
      const classStr = match[1]
      if (!classStr)
        continue
      for (const cls of classStr.split(/\s+/)) {
        if (cls && !cls.includes('{') && !cls.includes('$'))
          classes.add(cls)
      }
    }

    // Extract from :class="{ 'class-name': condition }" - get the class names
    for (const match of template.matchAll(/:class="\{([^}]+)\}"/g)) {
      const objContent = match[1]
      if (!objContent)
        continue
      // Match 'class-name' or "class-name" keys
      for (const keyMatch of objContent.matchAll(/['"]([^'"]+)['"]\s*:/g)) {
        const cls = keyMatch[1]
        if (cls && !cls.includes('{') && !cls.includes('$'))
          classes.add(cls)
      }
    }

    // Extract from :class="[condition ? 'class1' : 'class2']" - get both classes
    const arrayClassMatch = template.match(/:class="\[[^\]]+\]"/g)
    if (arrayClassMatch) {
      for (const arrayExpr of arrayClassMatch) {
        for (const match of arrayExpr.matchAll(/['"]([\w:-]+)['"]/g)) {
          const cls = match[1]
          if (cls && !cls.includes('{') && !cls.includes('$'))
            classes.add(cls)
        }
      }
    }
  }

  return classes
}

/**
 * Filter classes to only those that need TW4 processing.
 * Excludes responsive prefixes (handled at runtime) and unsupported classes.
 */
export function filterProcessableClasses(classes: Set<string>): string[] {
  const processable: string[] = []
  const responsivePrefixes = ['sm:', 'md:', 'lg:', 'xl:', '2xl:']

  for (const cls of classes) {
    // Skip responsive variants - handled at runtime
    if (responsivePrefixes.some(p => cls.startsWith(p))) {
      // Add the base class without prefix
      const baseClass = cls.replace(/^(sm|md|lg|xl|2xl):/, '')
      if (baseClass)
        processable.push(baseClass)
      continue
    }

    // Skip state variants that Satori can't handle
    if (cls.includes('hover:') || cls.includes('focus:') || cls.includes('active:'))
      continue

    // Skip dark mode variants
    if (cls.startsWith('dark:'))
      continue

    processable.push(cls)
  }

  // Dedupe
  return [...new Set(processable)]
}
