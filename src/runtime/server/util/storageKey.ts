import { digestCanonical } from '../../shared/urlEncoding'

declare const storageKeyBrand: unique symbol

/**
 * A storage key made of a fixed namespace and a SHA-256 hex digest. Only
 * `toStorageKey` creates one, so every key has the same short, fixed format
 * whatever the identity it stands for.
 */
export type StorageKey = string & { readonly [storageKeyBrand]: true }

/** Each namespace keeps one kind of entry apart from the others. */
export type StorageKeyNamespace = 'image' | 'devtools' | 'emoji' | 'prerender'

/** Derive the storage key for an identity. The same identity always gives the same key. */
export function toStorageKey(namespace: StorageKeyNamespace, identity: unknown): StorageKey {
  return `${namespace}:${digestCanonical(identity)}` as StorageKey
}
