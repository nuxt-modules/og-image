// Race `promise` against a deadline. The loser keeps running — JS has no
// generic cancellation — but the await-chain unblocks so upstream timeouts
// (renderTimeout, the takumi lock, etc.) don't accumulate behind it.
// The error message contains "timed out" so eventHandlers maps it to 408.
// Accepts sync values too (hookable's callHook returns `void | Promise<any>`).
export function withTimeout<T>(promise: Promise<T> | T, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      )
    }),
  ]).finally(() => clearTimeout(timer))
}
