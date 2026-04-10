import { describe, expect, it } from "vitest"

import { transformToView, viewToTransform, zoomPanTrajectory } from "../../src/dom/zoom-pan-curve"

describe("zoomPanTrajectory", () => {
  it("identity: start === end yields zero-duration trajectory", () => {
    const v = { x: 0, y: 0, w: 1 }
    const traj = zoomPanTrajectory(v, v)
    expect(traj.duration).toBeCloseTo(0, 5)
    const mid = traj.at(0.5)
    expect(mid.x).toBeCloseTo(0)
    expect(mid.y).toBeCloseTo(0)
    expect(mid.w).toBeCloseTo(1)
  })

  it("pure zoom (no pan): trajectory stays at same position", () => {
    const v0 = { x: 10, y: 20, w: 1 }
    const v1 = { x: 10, y: 20, w: 0.5 } // zoom in 2×
    const traj = zoomPanTrajectory(v0, v1)
    expect(traj.duration).toBeGreaterThan(0)
    const mid = traj.at(0.5)
    expect(mid.x).toBeCloseTo(10)
    expect(mid.y).toBeCloseTo(20)
    // w should be between 1 and 0.5
    expect(mid.w).toBeGreaterThan(0.4)
    expect(mid.w).toBeLessThan(1.1)
  })

  it("pure pan (same scale): x/y interpolate between start and end", () => {
    const v0 = { x: 0, y: 0, w: 1 }
    const v1 = { x: 100, y: 0, w: 1 }
    const traj = zoomPanTrajectory(v0, v1)
    expect(traj.duration).toBeGreaterThan(0)
    // At t=0 should be at start
    const start = traj.at(0)
    expect(start.x).toBeCloseTo(0, 0)
    expect(start.y).toBeCloseTo(0, 0)
    // At t=1 should be at end
    const end = traj.at(1)
    expect(end.x).toBeCloseTo(100, 0)
    expect(end.y).toBeCloseTo(0, 0)
    expect(end.w).toBeCloseTo(1, 1)
  })

  it("boundary: at(0) ≈ v0 and at(1) ≈ v1", () => {
    const v0 = { x: -50, y: 30, w: 1 }
    const v1 = { x: 80, y: -20, w: 0.25 }
    const traj = zoomPanTrajectory(v0, v1)
    const start = traj.at(0)
    const end = traj.at(1)
    expect(start.x).toBeCloseTo(v0.x, 0)
    expect(start.y).toBeCloseTo(v0.y, 0)
    expect(start.w).toBeCloseTo(v0.w, 2)
    expect(end.x).toBeCloseTo(v1.x, 0)
    expect(end.y).toBeCloseTo(v1.y, 0)
    expect(end.w).toBeCloseTo(v1.w, 1)
  })

  it("monotonic: w first zooms out then zooms in (flight path)", () => {
    // Pan + zoom-in: the optimal path zooms out first to see both
    // endpoints, then zooms in at the destination. This is the
    // characteristic "flight" of the van Wijk curve.
    const v0 = { x: 0, y: 0, w: 0.5 }
    const v1 = { x: 200, y: 0, w: 0.5 }
    const traj = zoomPanTrajectory(v0, v1)
    const midW = traj.at(0.5).w
    // Mid-flight w should be larger (more zoomed out) than endpoints.
    expect(midW).toBeGreaterThan(0.5)
  })
})

describe("transformToView / viewToTransform", () => {
  it("round-trips correctly", () => {
    const t = { x: 10, y: -5, scale: 4 }
    const v = transformToView(t)
    expect(v.w).toBeCloseTo(0.25)
    const back = viewToTransform(v)
    expect(back.x).toBeCloseTo(t.x)
    expect(back.y).toBeCloseTo(t.y)
    expect(back.scale).toBeCloseTo(t.scale)
  })
})
