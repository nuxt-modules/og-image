import { defineEventHandler } from 'h3'
import { getOgImageUrl } from '#imports'

export default defineEventHandler(event => ({
  url: getOgImageUrl(event, '/', { component: 'NuxtSeo.satori', props: { title: 'From Nitro' } }),
}))
