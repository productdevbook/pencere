import { clampScale, distance, IDENTITY, midpoint, scaleAround, translate } from "./transform"
import type { Transform2D } from "./transform"

interface PointerSample {
  id: number
  x: number
  y: number
  startX: number
  startY: number
  startedAt: number
}

export type GestureEventType = "start" | "pan" | "pinch" | "end" | "tap" | "doubleTap"

export interface GestureSnapshot {
  type: GestureEventType
  transform: Transform2D
  delta?: { dx: number; dy: number }
  swipe?: { direction: "up" | "down" | "left" | "right"; velocity: number }
}

export interface GestureEngineOptions {
  /** Clamp the output scale to this range. Default [1, 8]. */
  minScale?: number
  maxScale?: number
  /** Tap threshold in pixels. Default 8. */
  tapThreshold?: number
  /** Tap timeout in ms. Default 250. */
  tapTimeout?: number
  /** Double-tap window in ms. Default 300. */
  doubleTapWindow?: number
  /** Emit callback with every gesture update. */
  onUpdate?: (snapshot: GestureSnapshot) => void
}

/**
 * A small Pointer Events-based gesture engine shared by the lightbox.
 *
 * Responsibilities:
 * - unify mouse/touch/pen into a single pipeline via Pointer Events
 * - pan with one pointer
 * - pinch-zoom around the centroid with two pointers
 * - tap / double-tap detection with configurable thresholds
 *
 * Swipe / drag-to-dismiss / momentum live in a higher-level controller
 * (next commit) so this class stays focused and testable.
 */
export class GestureEngine {
  private readonly el: HTMLElement
  private readonly opts: Required<Omit<GestureEngineOptions, "onUpdate">> & {
    onUpdate?: GestureEngineOptions["onUpdate"]
  }
  private readonly pointers = new Map<number, PointerSample>()
  private transform: Transform2D = IDENTITY
  private lastPinchDistance = 0
  private lastTap = { time: 0, x: 0, y: 0 }
  /**
   * rAF throttle state (#34). pointermove fires at the device sample
   * rate — on modern iPads that can be 120 Hz while the display only
   * commits at 60 Hz, wasting ~half of the transform work. We coalesce
   * all moves received within one frame into a single emit.
   */
  private rafId: number | null = null
  private pendingEmit: { type: "pan" | "pinch"; delta?: { dx: number; dy: number } } | null = null
  private readonly onPointerDown = (e: PointerEvent): void => this.handleDown(e)
  private readonly onPointerMove = (e: PointerEvent): void => this.handleMove(e)
  private readonly onPointerUp = (e: PointerEvent): void => this.handleUp(e)
  private readonly onPointerCancel = (e: PointerEvent): void => this.handleUp(e)

  constructor(el: HTMLElement, opts: GestureEngineOptions = {}) {
    this.el = el
    this.opts = {
      minScale: opts.minScale ?? 1,
      maxScale: opts.maxScale ?? 8,
      tapThreshold: opts.tapThreshold ?? 8,
      tapTimeout: opts.tapTimeout ?? 250,
      doubleTapWindow: opts.doubleTapWindow ?? 300,
      onUpdate: opts.onUpdate,
    }
    // touch-action:none ensures the browser does not steal the gesture
    // for its own pinch-zoom / double-tap-zoom.
    this.el.style.touchAction = "none"
  }

  private attached = false

  attach(): void {
    // Idempotent: a second `attach()` without an intervening
    // `detach()` is a no-op. Otherwise listeners would stack up on
    // the stage element across repeated open() calls.
    if (this.attached) return
    this.attached = true
    this.el.addEventListener("pointerdown", this.onPointerDown)
    this.el.addEventListener("pointermove", this.onPointerMove)
    this.el.addEventListener("pointerup", this.onPointerUp)
    this.el.addEventListener("pointercancel", this.onPointerCancel)
    this.el.addEventListener("pointerleave", this.onPointerCancel)
  }

  detach(): void {
    if (!this.attached) return
    this.attached = false
    this.el.removeEventListener("pointerdown", this.onPointerDown)
    this.el.removeEventListener("pointermove", this.onPointerMove)
    this.el.removeEventListener("pointerup", this.onPointerUp)
    this.el.removeEventListener("pointercancel", this.onPointerCancel)
    this.el.removeEventListener("pointerleave", this.onPointerCancel)
    this.cancelPendingEmit()
    this.pointers.clear()
  }

  [Symbol.dispose](): void {
    this.detach()
  }

  reset(): void {
    this.cancelPendingEmit()
    this.transform = IDENTITY
    this.pointers.clear()
    this.lastPinchDistance = 0
    this.emit("end")
  }

  /** Visible for tests: force-drain the rAF queue synchronously. */
  flushPendingEmit(): void {
    if (this.rafId === null && this.pendingEmit === null) return
    const pending = this.pendingEmit
    // Clear scheduling state first so the flushed emit cannot loop
    // back into queueEmit via a listener.
    if (this.rafId !== null) {
      const caf: typeof cancelAnimationFrame =
        typeof cancelAnimationFrame === "function"
          ? cancelAnimationFrame
          : (id: number): void => {
              clearTimeout(id as unknown as ReturnType<typeof setTimeout>)
            }
      caf(this.rafId)
      this.rafId = null
    }
    this.pendingEmit = null
    if (pending) this.emit(pending.type, pending.delta)
  }

  get current(): Transform2D {
    return this.transform
  }

  /**
   * Programmatically set the transform (used by wheel zoom, double-tap
   * zoom, and other non-pointer sources). Emits a synthetic pinch event
   * so the viewer can repaint.
   */
  setTransform(t: Transform2D): void {
    this.transform = clampScale(t, this.opts.minScale, this.opts.maxScale)
    this.emit("pinch")
  }

  /** Public for tests: inject synthetic pointer events. */
  handleDown(e: PointerEvent): void {
    // Let clicks on interactive controls (buttons, links) flow through
    // without being captured as a gesture — otherwise setPointerCapture
    // would steal the pointerup and the browser would never fire click.
    const target = e.target as Element | null
    if (target?.closest("button, a, [data-pc-no-gesture]")) return
    try {
      this.el.setPointerCapture(e.pointerId)
    } catch {
      // jsdom / older browsers may throw — safe to ignore.
    }
    this.pointers.set(e.pointerId, {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      startedAt: e.timeStamp || performance.now(),
    })
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      this.lastPinchDistance = distance(a!, b!)
    }
    this.emit("start")
  }

  handleMove(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId)
    if (!p) return
    p.x = e.clientX
    p.y = e.clientY

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      const dist = distance(a!, b!)
      if (this.lastPinchDistance > 0) {
        const k = dist / this.lastPinchDistance
        const mid = midpoint(a!, b!)
        // Convert the pinch midpoint from viewport coordinates to an
        // offset relative to the element's center.  The image uses
        // `transform-origin: center center`, so scaleAround must
        // receive coordinates in the same frame — otherwise each
        // pinch frame drifts toward (0, 0) and the zoom appears to
        // pull toward the bottom-right on iOS (#pinch-origin).
        const rect = this.el.getBoundingClientRect()
        const ox = mid.x - (rect.left + rect.width / 2)
        const oy = mid.y - (rect.top + rect.height / 2)
        this.transform = clampScale(
          scaleAround(this.transform, k, ox, oy),
          this.opts.minScale,
          this.opts.maxScale,
        )
      }
      this.lastPinchDistance = dist
      this.queueEmit("pinch")
    } else if (this.pointers.size === 1) {
      // Compute delta from the prior position — not the start position —
      // so this is true per-frame movement.
      const dx = e.movementX || 0
      const dy = e.movementY || 0
      this.transform = translate(this.transform, dx, dy)
      // Coalesce per-frame pan deltas so a fast 120 Hz trackpad does
      // not fire six emits between two display commits.
      const prior = this.pendingEmit?.type === "pan" ? this.pendingEmit.delta : undefined
      const merged = prior ? { dx: prior.dx + dx, dy: prior.dy + dy } : { dx, dy }
      this.queueEmit("pan", merged)
    }
  }

  /**
   * Schedule a single emit on the next animation frame. Subsequent
   * pointermove events that arrive inside the same frame overwrite
   * the pending snapshot (pinch) or accumulate the delta (pan), so
   * the caller always sees the freshest transform per display commit.
   */
  private queueEmit(type: "pan" | "pinch", delta?: { dx: number; dy: number }): void {
    this.pendingEmit = { type, delta }
    if (this.rafId !== null) return
    const raf: typeof requestAnimationFrame =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (cb: FrameRequestCallback): number =>
            setTimeout(() => cb(performance.now()), 16) as unknown as number
    this.rafId = raf(() => {
      this.rafId = null
      const pending = this.pendingEmit
      this.pendingEmit = null
      if (pending) this.emit(pending.type, pending.delta)
    })
  }

  private cancelPendingEmit(): void {
    if (this.rafId === null) return
    const caf: typeof cancelAnimationFrame =
      typeof cancelAnimationFrame === "function"
        ? cancelAnimationFrame
        : (id: number): void => {
            clearTimeout(id as unknown as ReturnType<typeof setTimeout>)
          }
    caf(this.rafId)
    this.rafId = null
    this.pendingEmit = null
  }

  handleUp(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId)
    if (!p) return
    // Flush any pending rAF emit synchronously so the final transform
    // lands before "end" fires (consumers rely on this ordering for
    // momentum handoff and swipe release).
    this.flushPendingEmit()
    this.pointers.delete(e.pointerId)
    const now = e.timeStamp || performance.now()
    const dx = p.x - p.startX
    const dy = p.y - p.startY
    const moved = Math.hypot(dx, dy)
    const duration = now - p.startedAt
    const isTap = moved < this.opts.tapThreshold && duration < this.opts.tapTimeout

    if (isTap && this.pointers.size === 0) {
      const isDoubleTap =
        this.lastTap.time > 0 &&
        now - this.lastTap.time < this.opts.doubleTapWindow &&
        Math.hypot(p.x - this.lastTap.x, p.y - this.lastTap.y) < 30
      if (isDoubleTap) {
        this.lastTap = { time: 0, x: 0, y: 0 }
        this.emit("doubleTap")
      } else {
        this.lastTap = { time: now, x: p.x, y: p.y }
        this.emit("tap")
      }
    }
    if (this.pointers.size < 2) this.lastPinchDistance = 0
    // Re-grip support (#45): when a user lifts one of two fingers
    // mid-pinch, the remaining pointer would otherwise start panning
    // from its last-seen position with a stale `movementX/Y`, which
    // looks like a jump. Re-anchor every surviving pointer to its
    // current location so the next handleMove computes a delta of
    // zero until the finger actually moves.
    if (this.pointers.size >= 1) {
      for (const survivor of this.pointers.values()) {
        survivor.startX = survivor.x
        survivor.startY = survivor.y
      }
    }
    if (this.pointers.size === 0) this.emit("end")
  }

  private emit(type: GestureEventType, delta?: { dx: number; dy: number }): void {
    this.opts.onUpdate?.({ type, transform: this.transform, delta })
  }
}
