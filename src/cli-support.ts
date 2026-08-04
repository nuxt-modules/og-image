import { fileURLToPath } from 'node:url'
import { migrateDefaultsComponent, migrateFontsConfig } from './migrations/fonts'

export { migrateDefaultsComponent, migrateFontsConfig }

export function resolveCommunityTemplateDir(): string {
  return fileURLToPath(new URL('./runtime/app/components/Templates/Community', import.meta.url))
}
