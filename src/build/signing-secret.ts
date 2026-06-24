export interface SigningSecretResolution {
  /** Secret to bake into the runtime config (`''` when signing is disabled). */
  secret: string
  /** True when the user provided an explicit secret (config value or env var). */
  hasExplicit: boolean
  /** True when the user explicitly disabled signing via `security.secret: false`. */
  optOut: boolean
  /** True when `secret` was auto-generated (no explicit value, not opted out). */
  generated: boolean
}

/**
 * Resolve the URL-signing secret at build time.
 *
 * Precedence: explicit opt-out (`secret: false`) → explicit config/env value →
 * auto-generated. Auto-generation turns signing on by default; the generated
 * value is random and server-only but rotates per build, so an explicit secret
 * is still recommended for rolling/multi-instance deploys.
 *
 * `generate` is injected so callers control the source (and tests stay
 * deterministic); production passes a CSPRNG.
 */
export function resolveSigningSecret(
  configSecret: string | false | undefined,
  envSecret: string | undefined,
  generate: () => string,
): SigningSecretResolution {
  if (configSecret === false)
    return { secret: '', hasExplicit: false, optOut: true, generated: false }

  const explicit = (configSecret || '') || (envSecret || '')
  if (explicit)
    return { secret: explicit, hasExplicit: true, optOut: false, generated: false }

  return { secret: generate(), hasExplicit: false, optOut: false, generated: true }
}
