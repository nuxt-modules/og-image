help: cache bases for cached data #356
@remihuigen
Description
Remi Huigen
opened on Apr 9 · edited by remihuigen
📚 What are you trying to do?
I've deployed our Nuxt app to Cloudflare using NuxtHub.

I'm generating OG images at runtime (the entire app is server-rendered, so pre-generating images isn't feasible) and setting a cache expiration time of 31 days.

Everything works well, except for two issues related to caching:

Version-based cache key invalidation
It appears that the cached data is scoped under a base that includes the current Nuxt OG Image version (see screenshot). As a result, any time a new version of the package is released, the cache is effectively invalidated—even if nothing else has changed.

Namespace creation
For each unique route, a new KV namespace seems to be used(?)—likely because the cache key includes something like {{ogImage.version}}:{{request.pathname}}. This might cause concern for apps with many routes, for example with Cloudflare KV namespace limit.

So my question is: Is there currently a way to customize the cache key strategy?
I couldn’t find anything in the documentation, and a dive into the source code didn’t reveal an obvious solution either.

Here's our current config:

ogImage: {
runtimeCacheStorage: process.env.NODE_ENV === 'production'
? {
driver: 'cloudflare-kv-binding',
binding: 'CACHE'
}
: false,
defaults: {
cacheMaxAgeSeconds: process.env.NODE_ENV === 'production' ? 60 * 60 * 24 * 31 : 0
},
zeroRuntime: false
}
Image

🔍 What have you tried?
No response

ℹ️ Additional context
No response

🆒 Your use case
When configuring ogImage it would be great if there is somewhat more flexibility in how route queries are handled, or how cache keys are created.

Currently, any unique route query will create a new cache entry. But for most purposes, this not needed. (at least not in my case).

Let's say there is an og image cached for example.com/my-dynamic-page. When i request the route example.com/my-dynamic-page?foo=bar, the requested og image resource is

example.com/__og-image__/image/my-dynamic-page/og.png?foo=bar&_query=%7B%22foo%22:%22bar%22%7D

The existing cache is not hit, a new image will be rendered and cached thats identical to the original, except for the key it's stored under.

🆕 The solution you'd like
I'm aware that this might be exactly what you want, especially is the route query has an effect on the content for the og image. But for most of my projects, that is not the case.

I think the simplest solution would be to add a config option

ogImage: {
runtimeCacheStorage: {
// driver options
},
defaults: {
cacheMaxAgeSeconds: 60 * 60 * 24 * 7,
},
ignoreQuery: true,
zeroRuntime: false
}
Which should have the effect that the asset from my example would be requested at
example.com/__og-image__/image/my-dynamic-page/og.png, regardless of what query was used.

As an alternative, you could provided a getKey handler option, so we'd be able to fully customise the cache keys

🔍 Alternatives you've considered
I'm currently using this workaround in my server middleware

import { parseURL } from 'ufo'

export default defineEventHandler(async (event) => {
// Skip during prerendering
if (import.meta.prerender) return

const { pathname, search } = parseURL(event.path)

// Check if ogImage with query in pathname. If so, redirect to path without query
if (pathname.startsWith('/__og-image') && !!search) {
await sendRedirect(event, pathname, 301)
return
}
})

ℹ️ Additional info
No response

Hello currently I set runtime cache storage as so:

ogImage: {
runtimeCacheStorage: {
driver: 'redis',
host: process.env.NUXT_REDIS_HOST,
port: 6379,
ttlSeconds: 60 * 60 * 24 * 3,
base: 'best-og',
password: process.env.NUXT_REDIS_PASSWORD,
},
}
I also have a nitro plugin to register redis storage (Independent of og:image config)

export default defineNitroPlugin(() => {
const storage = useStorage()
const config = useRuntimeConfig()

const driver = redisDriver({
base: config.redis.base,
host: config.redis.host,
port: 6379,
ttl: 60 * 60 * 24 * 3, // 3 days
password: config.redis.password,
})

// Mount driver
storage.mount('redis', driver)

// https://nitro.unjs.io/guide/cache
// Use redis on cache instead of memory
await storage.unmount('cache')
storage.mount('cache', driver)
})
Module works fine with above config however I was wondering if there is a better way of doing it.
