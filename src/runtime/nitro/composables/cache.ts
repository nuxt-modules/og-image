import { prefixStorage } from 'unstorage'

export const optionCacheStorage = prefixStorage(useStorage(), 'og-image:options:cache')
