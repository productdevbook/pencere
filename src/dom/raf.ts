/**
 * Cross-environment requestAnimationFrame / cancelAnimationFrame.
 *
 * Wraps the globals so test suites that replace
 * `globalThis.requestAnimationFrame` still take effect. Falls back
 * to setTimeout(cb, 16) in environments without a real compositor.
 */
export function raf(cb: FrameRequestCallback): number {
  return typeof requestAnimationFrame === "function"
    ? requestAnimationFrame(cb)
    : (setTimeout(() => cb(performance.now()), 16) as unknown as number)
}

export function caf(id: number): void {
  if (typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(id)
  } else {
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>)
  }
}
