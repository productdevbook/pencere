/**
 * Velocity-based momentum helper used by the gesture controller to
 * add inertia after a pan. Records the last N samples and integrates
 * a simple friction loop via `requestAnimationFrame`.
 */

export interface VelocitySample {
  x: number;
  y: number;
  t: number;
}

/**
 * Compute velocity in pixels-per-millisecond from the last samples.
 * Returns {vx, vy} in px/ms.
 */
export function computeVelocity(samples: readonly VelocitySample[]): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 };
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  const dt = last.t - first.t;
  if (dt <= 0) return { vx: 0, vy: 0 };
  return {
    vx: (last.x - first.x) / dt,
    vy: (last.y - first.y) / dt,
  };
}

/**
 * Swipe direction + speed classification given a velocity vector.
 * Returns null when velocity is below the minimum threshold.
 */
export function classifySwipe(
  vx: number,
  vy: number,
  minSpeed = 0.4,
): { direction: "up" | "down" | "left" | "right"; velocity: number } | null {
  const speed = Math.hypot(vx, vy);
  if (speed < minSpeed) return null;
  const absX = Math.abs(vx);
  const absY = Math.abs(vy);
  if (absX > absY) {
    return { direction: vx > 0 ? "right" : "left", velocity: speed };
  }
  return { direction: vy > 0 ? "down" : "up", velocity: speed };
}

/**
 * Run a friction loop until velocity drops below `minSpeed` or
 * `onFrame` returns false to cancel. Returns a cancel function.
 */
export function runMomentum(
  vx: number,
  vy: number,
  onFrame: (dx: number, dy: number) => boolean | void,
  options: { friction?: number; minSpeed?: number } = {},
): () => void {
  const friction = options.friction ?? 0.94;
  const minSpeed = options.minSpeed ?? 0.05;
  let rafId = 0;
  let cancelled = false;
  const step = (): void => {
    if (cancelled) return;
    const cont = onFrame(vx, vy);
    if (cont === false) return;
    vx *= friction;
    vy *= friction;
    if (Math.hypot(vx, vy) < minSpeed) return;
    rafId = requestAnimationFrame(step);
  };
  rafId = requestAnimationFrame(step);
  return (): void => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
  };
}
