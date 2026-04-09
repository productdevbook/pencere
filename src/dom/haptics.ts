/**
 * Thin wrapper around the Vibration API.
 *
 * Haptics are intentionally opt-in: unprompted vibration on a desktop
 * is noise, on a mobile it is actively harmful to users who ship with
 * reduced-motion or vestibular-disorder accommodations. The viewer
 * passes an explicit `haptics: true` (or an object with overrides)
 * before this module does anything at all.
 *
 * Even once enabled, we gate on two checks before calling
 * `navigator.vibrate`:
 *
 * 1. The UA must expose `navigator.vibrate`. Safari on iOS does not
 *    and never will, so the feature no-ops for Apple users entirely.
 * 2. The primary input must be coarse — `matchMedia('(any-pointer:
 *    coarse)')`. A vibrating laptop trackpad is not useful and some
 *    third-party BT devices route `navigator.vibrate` to the phone
 *    they are paired with, which is surprising.
 *
 * Tests cover every branch.
 */

export interface HapticPatterns {
  /** Fired when the swipe-to-dismiss threshold is crossed. */
  dismiss?: number | number[]
  /** Fired when zoom or pan snaps back to identity. */
  snap?: number | number[]
  /** Fired on double-tap toggle between 1× and 2×. */
  doubleTap?: number | number[]
}

export interface HapticsOptions {
  /** Master switch. Defaults to `false`. */
  enabled?: boolean
  /** Per-event pattern overrides (ms or ms pattern). */
  patterns?: HapticPatterns
}

const DEFAULT_PATTERNS: Required<HapticPatterns> = {
  dismiss: 12,
  snap: 8,
  doubleTap: 6,
}

interface VibrateNavigator {
  vibrate?: (pattern: number | number[]) => boolean
}

export class Haptics {
  private readonly enabled: boolean
  private readonly patterns: Required<HapticPatterns>

  constructor(options: HapticsOptions = {}) {
    this.enabled = options.enabled === true
    this.patterns = { ...DEFAULT_PATTERNS, ...options.patterns }
  }

  /** True only when haptics are enabled AND the environment can play them. */
  get available(): boolean {
    if (!this.enabled) return false
    if (typeof navigator === "undefined") return false
    const nav = navigator as unknown as VibrateNavigator
    if (typeof nav.vibrate !== "function") return false
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
    try {
      return window.matchMedia("(any-pointer: coarse)").matches
    } catch {
      return false
    }
  }

  fire(event: keyof HapticPatterns): void {
    if (!this.available) return
    const pattern = this.patterns[event]
    try {
      ;(navigator as unknown as VibrateNavigator).vibrate?.(pattern)
    } catch {
      // Some embedded browsers throw on unsupported patterns.
    }
  }
}
