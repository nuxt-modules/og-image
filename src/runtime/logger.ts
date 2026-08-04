import { colorize } from 'consola/utils'
import { createModuleLogger } from 'nuxtseo-shared/utils'

export const logger = createModuleLogger('@nuxtjs/og-image')

export const gray = (s: string) => colorize('gray', s)
