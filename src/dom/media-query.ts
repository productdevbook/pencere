/**
 * Tiny reactive wrapper around `matchMedia` used for prefers-reduced-motion
 * and prefers-contrast hooks. SSR-safe: returns a stub when `matchMedia`
 * is unavailable.
 */
export interface MediaQueryHandle {
  readonly matches: boolean
  subscribe(fn: (matches: boolean) => void): () => void
  dispose(): void
}

export function createMediaQuery(query: string): MediaQueryHandle {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return {
      matches: false,
      subscribe() {
        return () => {}
      },
      dispose() {},
    }
  }
  const mql = window.matchMedia(query)
  const listeners = new Set<(matches: boolean) => void>()
  const onChange = (e: MediaQueryListEvent): void => {
    for (const fn of listeners) fn(e.matches)
  }
  mql.addEventListener("change", onChange)
  return {
    get matches(): boolean {
      return mql.matches
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    dispose() {
      mql.removeEventListener("change", onChange)
      listeners.clear()
    },
  }
}

export function prefersReducedMotion(): MediaQueryHandle {
  return createMediaQuery("(prefers-reduced-motion: reduce)")
}
