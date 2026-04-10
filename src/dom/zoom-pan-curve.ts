/**
 * Van Wijk & Nuij (2003) optimal zoom-pan trajectory.
 *
 * Generates a smooth flight path between two views (position + scale)
 * along a logarithmic curve that minimises perceived user
 * disorientation. The same algorithm powers d3-zoom, Google Maps,
 * and OpenSeadragon.
 *
 * Reference: Jarke J. van Wijk & Wim A.A. Nuij, "Smooth and
 * efficient zooming and panning", IEEE InfoVis 2003.
 *
 * @see https://doi.org/10.1109/INFVIS.2003.1249004
 */

export interface ZoomPanView {
  x: number
  y: number
  /** Visual "width" — inversely proportional to zoom.  w = 1/scale. */
  w: number
}

/**
 * Precompute the trajectory between two views so `at(t)` is O(1).
 *
 * @param v0  Start view {x, y, w} where w = 1/startScale.
 * @param v1  End view {x, y, w} where w = 1/endScale.
 * @param rho Curvature parameter (ρ). Default √2 per the paper.
 * @returns   Object with `duration` (unitless S) and `at(t)` for t ∈ [0, 1].
 */
export function zoomPanTrajectory(
  v0: ZoomPanView,
  v1: ZoomPanView,
  rho: number = Math.SQRT2,
): { duration: number; at: (t: number) => ZoomPanView } {
  const dx = v1.x - v0.x
  const dy = v1.y - v0.y
  const d2 = dx * dx + dy * dy
  const d = Math.sqrt(d2)

  const rho2 = rho * rho
  const rho4 = rho2 * rho2

  // Special case: pure zoom (no pan). Avoid division by zero in the
  // general formula when d → 0.
  if (d < 1e-6) {
    const S = Math.abs(Math.log(v1.w / v0.w)) / rho
    return {
      duration: S,
      at(t: number): ZoomPanView {
        const wInterp = v0.w * Math.exp(Math.log(v1.w / v0.w) * t)
        return { x: v0.x, y: v0.y, w: wInterp }
      },
    }
  }

  // General case: simultaneous pan + zoom.
  //
  // b0 = (w1² − w0² + ρ⁴ d²) / (2 w0 ρ² d)
  // b1 = (w1² − w0² − ρ⁴ d²) / (2 w1 ρ² d)
  const b0 = (v1.w * v1.w - v0.w * v0.w + rho4 * d2) / (2 * v0.w * rho2 * d)
  const b1 = (v1.w * v1.w - v0.w * v0.w - rho4 * d2) / (2 * v1.w * rho2 * d)

  // r0 = log(−b0 + √(b0² + 1))  — i.e. asinh(b0) but negated
  // r1 = log(−b1 + √(b1² + 1))
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0)
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1)

  // Total path length S = (r1 − r0) / ρ.
  const S = (r1 - r0) / rho

  return {
    duration: Math.abs(S),
    at(t: number): ZoomPanView {
      const s = t * S
      const rhoS = rho * s + r0
      const coshR0 = Math.cosh(r0)
      const w = v0.w * (coshR0 / Math.cosh(rhoS))
      const u = ((v0.w / rho2) * (coshR0 * Math.tanh(rhoS) - Math.sinh(r0))) / d
      const uClamped = Math.max(0, Math.min(1, u))
      return {
        x: v0.x + dx * uClamped,
        y: v0.y + dy * uClamped,
        w,
      }
    },
  }
}

/**
 * Convert Transform2D {x, y, scale} to ZoomPanView {x, y, w}.
 * w = 1/scale (viewport width is inversely proportional to zoom).
 */
export function transformToView(t: { x: number; y: number; scale: number }): ZoomPanView {
  return { x: t.x, y: t.y, w: 1 / t.scale }
}

/**
 * Convert ZoomPanView back to Transform2D.
 */
export function viewToTransform(v: ZoomPanView): { x: number; y: number; scale: number } {
  return { x: v.x, y: v.y, scale: 1 / v.w }
}

/**
 * Animate a zoom-pan transition using requestAnimationFrame.
 * Returns a cancel function.
 *
 * @param from      Start transform {x, y, scale}.
 * @param to        End transform {x, y, scale}.
 * @param durationMs Animation duration in milliseconds.
 * @param onFrame   Called each frame with interpolated {x, y, scale}.
 * @param onDone    Called when animation completes (not called if cancelled).
 */
export function animateZoomPan(
  from: { x: number; y: number; scale: number },
  to: { x: number; y: number; scale: number },
  durationMs: number,
  onFrame: (t: { x: number; y: number; scale: number }) => void,
  onDone?: () => void,
): () => void {
  const trajectory = zoomPanTrajectory(transformToView(from), transformToView(to))
  let rafId = 0
  let cancelled = false
  let startTime = 0

  const step = (now: number): void => {
    if (cancelled) return
    if (startTime === 0) startTime = now
    const elapsed = now - startTime
    const t = Math.min(1, elapsed / durationMs)
    // Ease-out cubic for smoother deceleration.
    const eased = 1 - Math.pow(1 - t, 3)
    const view = trajectory.at(eased)
    const transform = viewToTransform(view)
    onFrame(transform)
    if (t < 1) {
      rafId = requestAnimationFrame(step)
    } else {
      onDone?.()
    }
  }

  rafId = requestAnimationFrame(step)
  return (): void => {
    cancelled = true
    if (rafId) cancelAnimationFrame(rafId)
  }
}
