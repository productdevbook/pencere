import { GestureEngine } from "./gesture"
import type { Haptics } from "./haptics"
import { runMomentum } from "./momentum"
import { SwipeNavigator } from "./swipe-nav"
import { IDENTITY, toCss } from "./transform"
import type { Transform2D } from "./transform"
import { animateZoomPan } from "./zoom-pan-curve"

export interface MotionControllerOptions {
  /** Root element of the dialog; read for opacity writes + rect. */
  root: HTMLElement
  /** Stage element; GestureEngine + swipe/wheel listeners attach here. */
  stage: HTMLElement
  /** Read current <img> at gesture time (may be null for non-image slides). */
  getCurrentImg: () => HTMLImageElement | null
  /** Read current writing direction (LTR / RTL flips swipe). */
  getDirection: () => "ltr" | "rtl"
  /** Shared haptics engine — MotionController fires doubleTap / snap / dismiss. */
  haptics: Haptics
  /** Navigation + dismissal callbacks into core. */
  onNext: () => void
  onPrev: () => void
  onDismiss: () => void
}

/**
 * Coordinates GestureEngine, SwipeNavigator and momentum so the
 * viewer doesn't have to juggle boolean flags across pointerdown /
 * move / up listeners. Replaces ~300 LOC of state machine scattered
 * across `viewer.ts` during Phase 1 of the refactor.
 *
 * State transitions:
 *   idle → swipeActive  (pointerdown at scale=1 over non-interactive)
 *   swipeActive → idle  (pointerup / cancel / released)
 *   idle → momentumRunning (release with "cancel" + non-zero delta)
 *   momentumRunning → idle (runMomentum resolves or cancelled)
 *
 * The viewer retains ownership of the image element, toolbars and
 * keyboard routing — it calls `panBy` / `zoomBy` / `zoomReset` from
 * its own handleKeyDown.
 */
export class MotionController {
  readonly gesture: GestureEngine
  private readonly swipe = new SwipeNavigator()
  private swipeActivePointer: number | null = null
  private momentumCancel: (() => void) | null = null
  private zoomAnimCancel: (() => void) | null = null
  private readonly opts: MotionControllerOptions

  constructor(options: MotionControllerOptions) {
    this.opts = options
    this.gesture = new GestureEngine(options.stage, {
      onUpdate: (snapshot) => {
        if (snapshot.type === "tap" && !options.stage.matches(":hover")) return
        if (snapshot.type === "doubleTap") {
          this.handleDoubleTap()
          return
        }
        const img = options.getCurrentImg()
        // `will-change: transform` is promoted to a compositor layer
        // by the browser but keeps that layer alive indefinitely —
        // promote on start, demote on end. #34.
        if (snapshot.type === "start" && img) {
          img.style.setProperty("will-change", "transform")
        } else if (snapshot.type === "end" && img) {
          img.style.removeProperty("will-change")
        }
        // While a scale=1 swipe is in flight, the swipe controller
        // owns the visual transform — don't let gesture pan overwrite.
        if (this.swipe.isActive) return
        this.writeImgTransform(snapshot.transform)
      },
    })
  }

  /**
   * Wire pointer + wheel listeners. Must be called once after
   * construction — listeners are scoped to the supplied signal so
   * `destroy()` (which aborts the signal) tears them all down.
   */
  attach(signal: AbortSignal): void {
    const stage = this.opts.stage
    // Swipe navigation + drag-to-dismiss listeners. Registered in
    // capture phase so they run before GestureEngine's bubble
    // listeners and can short-circuit pan application while at scale=1.
    stage.addEventListener("pointerdown", (e) => this.onSwipeDown(e), { signal, capture: true })
    stage.addEventListener("pointermove", (e) => this.onSwipeMove(e), { signal, capture: true })
    stage.addEventListener("pointerup", (e) => this.onSwipeUp(e), { signal, capture: true })
    stage.addEventListener("pointercancel", (e) => this.onSwipeCancel(e), { signal, capture: true })
    stage.addEventListener("wheel", (e) => this.onWheelZoom(e), { signal, passive: false })
  }

  /** Enable GestureEngine pointer tracking — called on viewer open. */
  engage(): void {
    this.gesture.attach()
  }

  /** Disengage gesture tracking + cancel any running momentum/zoom. */
  disengage(): void {
    this.gesture.detach()
    this.gesture.reset()
    this.momentumCancel?.()
    this.momentumCancel = null
    this.zoomAnimCancel?.()
    this.zoomAnimCancel = null
  }

  /** Reset gesture transform (used between slides). */
  reset(): void {
    this.gesture.reset()
  }

  /** Write a transform onto the current image via CSS custom prop. */
  writeImgTransform(t: Transform2D): void {
    const img = this.opts.getCurrentImg()
    if (!img) return
    img.style.setProperty("--pc-img-transform", toCss(t))
  }

  /** Write a raw transform string (used by swipe controller). */
  writeImgTransformRaw(css: string): void {
    const img = this.opts.getCurrentImg()
    if (!img) return
    img.style.setProperty("--pc-img-transform", css)
  }

  /** Apply current gesture transform onto a freshly-mounted image. */
  applyCurrentTransform(img: HTMLImageElement): void {
    img.style.setProperty("--pc-img-transform", toCss(this.gesture.current))
  }

  /** Cancel any in-flight momentum animation. */
  cancelMomentum(): void {
    this.momentumCancel?.()
    this.momentumCancel = null
  }

  /**
   * WCAG 2.5.7 dragging alternative — shift pan translation by a
   * pixel vector. Called from the viewer's keyboard handler so
   * users who cannot drag can still reach every corner of a zoomed
   * image (#25).
   */
  panBy(dx: number, dy: number): void {
    if (!this.opts.getCurrentImg()) return
    const current = this.gesture.current
    if (current.scale <= 1) return
    this.gesture.setTransform({ x: current.x + dx, y: current.y + dy, scale: current.scale })
    this.writeImgTransform(this.gesture.current)
  }

  /** Zoom by a multiplicative factor around the image center. */
  zoomBy(factor: number): void {
    if (!this.opts.getCurrentImg()) return
    const current = this.gesture.current
    const newScale = Math.max(1, Math.min(8, current.scale * factor))
    if (newScale === current.scale) return
    const k = newScale / current.scale
    const next = { x: current.x * k, y: current.y * k, scale: newScale }
    const snapped = next.scale <= 1 ? IDENTITY : next
    this.gesture.setTransform(snapped)
    this.writeImgTransform(this.gesture.current)
  }

  zoomReset(): void {
    if (!this.opts.getCurrentImg()) return
    if (this.gesture.current.scale <= 1) return
    this.animateZoomTo(IDENTITY, 250)
  }

  /** Current scale — read by the viewer's keyboard handler for pan branch. */
  get scale(): number {
    return this.gesture.current.scale
  }

  /**
   * Animate a zoom transition using the van Wijk (2003) optimal
   * zoom-pan curve (#47). Cancels any in-flight zoom animation.
   * Skips animation when `prefers-reduced-motion: reduce` is active
   * or when `requestAnimationFrame` is unavailable (SSR / jsdom).
   */
  private animateZoomTo(target: Transform2D, durationMs = 300): void {
    this.zoomAnimCancel?.()
    // Skip animation for reduced-motion or non-browser environments.
    const prefersReduced =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced || durationMs <= 0) {
      this.gesture.setTransform(target)
      this.writeImgTransform(this.gesture.current)
      return
    }
    const from = this.gesture.current
    this.zoomAnimCancel = animateZoomPan(
      from,
      target,
      durationMs,
      (t) => {
        this.gesture.setTransform(t)
        this.writeImgTransform(this.gesture.current)
      },
      () => {
        this.zoomAnimCancel = null
      },
    )
  }

  private handleDoubleTap(): void {
    if (!this.opts.getCurrentImg()) return
    const current = this.gesture.current
    const next = current.scale > 1 ? IDENTITY : { x: 0, y: 0, scale: 2 }
    this.animateZoomTo(next)
    this.opts.haptics.fire("doubleTap")
  }

  private onWheelZoom(e: WheelEvent): void {
    const img = this.opts.getCurrentImg()
    if (!img) return
    e.preventDefault()
    // Exponential feel: each 300px of wheel delta ≈ e.
    const factor = Math.exp(-e.deltaY / 300)
    const current = this.gesture.current
    const newScale = Math.max(1, Math.min(8, current.scale * factor))
    const k = newScale / current.scale
    // With transform-origin:center, compute the vector from image
    // visual center to the cursor and adjust translation so the
    // point under the cursor stays fixed.
    const rect = img.getBoundingClientRect()
    const imgCx = rect.left + rect.width / 2
    const imgCy = rect.top + rect.height / 2
    const offsetX = e.clientX - imgCx
    const offsetY = e.clientY - imgCy
    const next = {
      x: current.x + offsetX * (1 - k),
      y: current.y + offsetY * (1 - k),
      scale: newScale,
    }
    const snapped = next.scale <= 1 ? IDENTITY : next
    if (snapped === IDENTITY && current.scale > 1) this.opts.haptics.fire("snap")
    this.gesture.setTransform(snapped)
    this.writeImgTransform(this.gesture.current)
  }

  private isSwipeEligible(): boolean {
    return this.gesture.current.scale === 1
  }

  private onSwipeDown(e: PointerEvent): void {
    if (!this.isSwipeEligible()) return
    if (this.swipeActivePointer !== null) return
    // Don't start a swipe when the user taps an interactive control.
    const target = e.target as Element | null
    if (target?.closest("button, a, [data-pc-no-gesture]")) return
    this.swipeActivePointer = e.pointerId
    this.cancelMomentum()
    this.swipe.begin(e.clientX, e.clientY, e.timeStamp || performance.now())
  }

  private onSwipeMove(e: PointerEvent): void {
    if (this.swipeActivePointer !== e.pointerId) return
    if (!this.isSwipeEligible()) {
      this.swipe.cancel()
      this.swipeActivePointer = null
      this.resetSwipeVisual()
      return
    }
    const { dx, dy, axis } = this.swipe.move(e.clientX, e.clientY, e.timeStamp || performance.now())
    if (!axis || !this.opts.getCurrentImg()) return
    // Horizontal: translate follows finger 1:1; vertical: translate + fade.
    if (axis === "horizontal") {
      this.writeImgTransformRaw(`translate3d(${dx.toFixed(1)}px, 0, 0)`)
      this.opts.root.style.setProperty("--pc-root-opacity", "1")
    } else {
      this.writeImgTransformRaw(`translate3d(0, ${dy.toFixed(1)}px, 0)`)
      const rect = this.opts.stage.getBoundingClientRect()
      const h = rect.height || 1
      const fade = Math.max(0.3, 1 - Math.abs(dy) / h)
      this.opts.root.style.setProperty("--pc-root-opacity", String(fade))
    }
  }

  private onSwipeUp(e: PointerEvent): void {
    if (this.swipeActivePointer !== e.pointerId) return
    this.swipeActivePointer = null
    const rect = this.opts.stage.getBoundingClientRect()
    const W = rect.width || this.opts.root.clientWidth || 0
    const H = rect.height || this.opts.root.clientHeight || 0
    const result = this.swipe.release(W, H, this.opts.getDirection())
    this.resetSwipeVisual()

    switch (result.action) {
      case "next":
        this.opts.onNext()
        break
      case "prev":
        this.opts.onPrev()
        break
      case "dismiss":
        this.opts.haptics.fire("dismiss")
        this.opts.onDismiss()
        break
      case "cancel": {
        // Run a short momentum spring back to origin.
        if (!this.opts.getCurrentImg()) return
        let x = result.dx
        let y = result.dy
        this.momentumCancel = runMomentum(
          -x * 0.2,
          -y * 0.2,
          (vx, vy) => {
            x += vx
            y += vy
            if (Math.hypot(x, y) < 0.5) {
              this.writeImgTransformRaw("translate3d(0,0,0)")
              return false
            }
            this.writeImgTransformRaw(`translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`)
          },
          { friction: 0.82 },
        )
        break
      }
    }
  }

  private onSwipeCancel(e: PointerEvent): void {
    if (this.swipeActivePointer !== e.pointerId) return
    this.swipeActivePointer = null
    this.swipe.cancel()
    this.resetSwipeVisual()
    // Snap the image back to the origin. Without this the image
    // stays offset at wherever the last pointermove left it until
    // the next slide change — stylus palm rejection, OS interrupts,
    // and cancelled pointer captures all trigger this path.
    if (this.opts.getCurrentImg()) {
      this.writeImgTransformRaw("translate3d(0,0,0)")
    }
  }

  private resetSwipeVisual(): void {
    this.opts.root.style.removeProperty("--pc-root-opacity")
  }
}
