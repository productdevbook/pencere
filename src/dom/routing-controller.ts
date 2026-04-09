import type { CloseReason } from "../types"

/** See `PencereViewerOptions.routing`. */
export interface RoutingOptions {
  /** Build the fragment for a given slide index. Default: `#p{n+1}`. */
  pattern?: (index: number) => string
  /**
   * Parse the current `location.hash` into a slide index, or return
   * `null` when the URL does not identify a slide. Default matches
   * the default pattern.
   */
  parse?: (hash: string) => number | null
}

export interface ResolvedRouting {
  pattern: (index: number) => string
  parse: (hash: string) => number | null
}

/**
 * Normalize the `routing` option into a concrete pattern/parse pair,
 * or `null` when routing is disabled.
 */
export function resolveRouting(
  option: boolean | RoutingOptions | undefined,
): ResolvedRouting | null {
  if (!option) return null
  const o = option === true ? {} : option
  const pattern = o.pattern ?? ((i: number) => `#p${i + 1}`)
  const parse =
    o.parse ??
    ((hash: string): number | null => {
      const m = /^#p(\d+)$/.exec(hash)
      if (!m) return null
      const n = Number.parseInt(m[1]!, 10)
      return Number.isFinite(n) && n >= 1 ? n - 1 : null
    })
  return { pattern, parse }
}

export interface RoutingControllerOptions {
  /** Resolved routing config, or `null` to disable. */
  routing: ResolvedRouting | null
  /** Called when popstate dismisses the viewer. */
  onPopClose: (reason: CloseReason) => void
  /** Query whether the viewer is currently open. */
  isOpen: () => boolean
  /** Query the currently displayed slide index. */
  getIndex: () => number
  /** Query the total number of items. */
  getItemCount: () => number
  /** Abort signal used to tear down the popstate listener. */
  signal: AbortSignal
}

/**
 * Hash-based deep linking (#75). On `open()` the controller pushes
 * `#p{n+1}` into the URL; on every slide change it replaces the
 * current entry; on `popstate` it closes the viewer so the browser
 * Back button dismisses the lightbox naturally.
 */
export class RoutingController {
  private readonly routing: ResolvedRouting | null
  private readonly onPopClose: (reason: CloseReason) => void
  private readonly isOpen: () => boolean
  private readonly getIndex: () => number
  private readonly getItemCount: () => number
  private routedOpen = false
  private suppressPop = false

  constructor(options: RoutingControllerOptions) {
    this.routing = options.routing
    this.onPopClose = options.onPopClose
    this.isOpen = options.isOpen
    this.getIndex = options.getIndex
    this.getItemCount = options.getItemCount

    if (this.routing && typeof window !== "undefined") {
      window.addEventListener(
        "popstate",
        () => {
          if (!this.isOpen()) return
          this.suppressPop = true
          this.onPopClose("user")
        },
        { signal: options.signal },
      )
    }
  }

  get enabled(): boolean {
    return this.routing !== null
  }

  /**
   * Look at the current `location.hash`, and if it identifies a
   * valid slide, return the matching index. Otherwise `null`.
   */
  parseCurrentLocation(): number | null {
    if (!this.routing) return null
    if (typeof location === "undefined") return null
    const idx = this.routing.parse(location.hash)
    if (idx === null) return null
    const total = this.getItemCount()
    if (idx < 0 || idx >= total) return null
    return idx
  }

  /** Push the current slide's fragment. Called from `open()`. */
  pushFragment(): void {
    this.syncFragment("push")
  }

  /** Replace the current slide's fragment. Called on `change`. */
  replaceFragment(): void {
    this.syncFragment("replace")
  }

  /**
   * Unwind any pushed history entry when the viewer closes from
   * inside pencere. popstate-driven closes must NOT step history
   * again.
   */
  handleClose(): void {
    const wasRouted = this.routedOpen
    // Always reset `routedOpen` so the NEXT open() call pushes a
    // fresh history entry. Previously this was gated on
    // `!suppressPop`, which meant popstate-driven closes (Back
    // button) left `routedOpen = true` and the next open issued a
    // `replaceState` instead of `pushState` — breaking the Back
    // button on the second open in the same session.
    this.routedOpen = false
    if (wasRouted && !this.suppressPop) {
      try {
        window.history.back()
      } catch {
        /* ignore */
      }
    }
    this.suppressPop = false
  }

  private syncFragment(mode: "push" | "replace"): void {
    if (!this.routing) return
    if (typeof window === "undefined") return
    const index = this.getIndex()
    const next = this.routing.pattern(index)
    const url = location.pathname + location.search + next
    try {
      if (mode === "push" && !this.routedOpen) {
        window.history.pushState({ pencere: true, i: index }, "", url)
        this.routedOpen = true
      } else {
        window.history.replaceState({ pencere: true, i: index }, "", url)
      }
    } catch {
      // Some sandboxed contexts throw on history mutation; ignore.
    }
  }
}
