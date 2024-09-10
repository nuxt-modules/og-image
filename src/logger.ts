import { useLogger } from '@nuxt/kit'
import { colorize } from 'consola/utils'

export const logger = useLogger('@nuxtjs/og-image')

export const gray = (s: string) => colorize('gray', s)
