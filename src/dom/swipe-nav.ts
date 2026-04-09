/**
 * SwipeNavigator — translates single-pointer pans at scale=1 into either
 * horizontal slide navigation (next/prev) or a vertical drag-to-dismiss.
 *
 * It is intentionally stateless about transforms — the caller owns the
 * visual feedback (translate + opacity) via `onDrag`, and decides what
 * to do on release via `onRelease`. This keeps it trivially testable.
 *
 * Thresholds follow the platform conventions documented in issue #42:
 * - horizontal commit at 25% of viewport width OR swipe velocity > 0.6
 * - vertical dismiss at 20% of viewport height OR downward velocity > 0.6
 */

import { classifySwipe, computeVelocity } from "./momentum"
import type { VelocitySample } from "./momentum"

export type SwipeAxis = "horizontal" | "vertical" | null

export interface SwipeRelease {
  /** Commit action suggested by gesture analysis. */
  action: "next" | "prev" | "dismiss" | "cancel"
  /** Final velocity in px/ms on the dominant axis. */
  velocity: number
  dx: number
  dy: number
}

export interface SwipeNavigatorOptions {
  /** Min pixel drift before an axis is locked. Default 8. */
  axisLockThreshold?: number
  /** Fraction of width that commits horizontal nav. Default 0.25. */
  horizontalCommit?: number
  /** Fraction of height that commits vertical dismiss. Default 0.2. */
  verticalCommit?: number
  /** Minimum velocity (px/ms) that commits regardless of distance. */
  flingVelocity?: number
}

export class SwipeNavigator {
  private readonly opts: Required<SwipeNavigatorOptions>
  private samples: VelocitySample[] = []
  private startX = 0
  private startY = 0
  private dx = 0
  private dy = 0
  private axis: SwipeAxis = null
  private active = false

  constructor(options: SwipeNavigatorOptions = {}) {
    this.opts = {
      axisLockThreshold: options.axisLockThreshold ?? 8,
      horizontalCommit: options.horizontalCommit ?? 0.25,
      verticalCommit: options.verticalCommit ?? 0.2,
      flingVelocity: options.flingVelocity ?? 0.6,
    }
  }

  get isActive(): boolean {
    return this.active
  }

  get currentAxis(): SwipeAxis {
    return this.axis
  }

  begin(x: number, y: number, t: number): void {
    this.active = true
    this.startX = x
    this.startY = y
    this.dx = 0
    this.dy = 0
    this.axis = null
    this.samples = [{ x, y, t }]
  }

  /** Returns current drift and locked axis; does not apply any transform. */
  move(x: number, y: number, t: number): { dx: number; dy: number; axis: SwipeAxis } {
    if (!this.active) return { dx: 0, dy: 0, axis: null }
    this.dx = x - this.startX
    this.dy = y - this.startY
    this.samples.push({ x, y, t })
    // Keep last ~80ms of samples for velocity.
    const cutoff = t - 80
    while (this.samples.length > 2 && this.samples[0]!.t < cutoff) this.samples.shift()

    if (this.axis === null) {
      const absX = Math.abs(this.dx)
      const absY = Math.abs(this.dy)
      if (Math.max(absX, absY) >= this.opts.axisLockThreshold) {
        this.axis = absX >= absY ? "horizontal" : "vertical"
      }
    }
    return { dx: this.dx, dy: this.dy, axis: this.axis }
  }

  release(viewportWidth: number, viewportHeight: number): SwipeRelease {
    const { vx, vy } = computeVelocity(this.samples)
    const swipe = classifySwipe(vx, vy, this.opts.flingVelocity)
    const result: SwipeRelease = {
      action: "cancel",
      velocity: 0,
      dx: this.dx,
      dy: this.dy,
    }

    if (this.axis === "horizontal") {
      const committed = Math.abs(this.dx) > viewportWidth * this.opts.horizontalCommit
      if (committed || (swipe && (swipe.direction === "left" || swipe.direction === "right"))) {
        result.action = this.dx < 0 ? "next" : "prev"
        result.velocity = Math.abs(vx)
      }
    } else if (this.axis === "vertical") {
      const committed = Math.abs(this.dy) > viewportHeight * this.opts.verticalCommit
      if (committed || (swipe && swipe.direction === "down")) {
        result.action = "dismiss"
        result.velocity = Math.abs(vy)
      }
    }

    this.active = false
    this.axis = null
    this.samples = []
    return result
  }

  cancel(): void {
    this.active = false
    this.axis = null
    this.samples = []
    this.dx = 0
    this.dy = 0
  }
}
