/**
 * 2D affine transform stored as {x, y, scale}. Rotation is omitted
 * for now — the lightbox uses axis-aligned pan + uniform zoom.
 */
export interface Transform2D {
  x: number
  y: number
  scale: number
}

export const IDENTITY: Transform2D = Object.freeze({ x: 0, y: 0, scale: 1 })

/**
 * Apply a scale delta `k` around a point `(px, py)`, preserving the
 * visual position of that point. This is the pinch-centroid math
 * used by PhotoSwipe, Google Maps, and every serious image viewer.
 *
 * Derivation: let the current transform map (u, v) → (u*scale+x, v*scale+y).
 * After scaling by `k` around (px, py) we want the pixel at (px, py)
 * to remain at (px, py). Solving the system yields:
 *
 *     newScale = scale * k
 *     newX     = px - (px - x) * k
 *     newY     = py - (py - y) * k
 */
export function scaleAround(t: Transform2D, k: number, px: number, py: number): Transform2D {
  return {
    x: px - (px - t.x) * k,
    y: py - (py - t.y) * k,
    scale: t.scale * k,
  }
}

/** Clamp scale to `[min, max]` without moving the origin. */
export function clampScale(t: Transform2D, min: number, max: number): Transform2D {
  if (t.scale < min) return { ...t, scale: min }
  if (t.scale > max) return { ...t, scale: max }
  return t
}

/** Translate by a pixel delta. */
export function translate(t: Transform2D, dx: number, dy: number): Transform2D {
  return { x: t.x + dx, y: t.y + dy, scale: t.scale }
}

/** Format as a CSS `transform` value using `translate3d` + `scale` for GPU compositing. */
export function toCss(t: Transform2D): string {
  return `translate3d(${t.x.toFixed(2)}px, ${t.y.toFixed(2)}px, 0) scale(${t.scale.toFixed(4)})`
}

/** Midpoint between two 2D points. */
export function midpoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Euclidean distance between two 2D points. */
export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}
