import { describe, expect, it } from "vitest"

import { SwipeNavigator } from "../../src/dom/swipe-nav"

describe("SwipeNavigator", () => {
  const W = 1000
  const H = 800

  it("locks horizontal axis after passing threshold", () => {
    const s = new SwipeNavigator()
    s.begin(100, 100, 0)
    expect(s.move(103, 101, 10).axis).toBe(null)
    expect(s.move(120, 102, 20).axis).toBe("horizontal")
  })

  it("rtl flips horizontal commit direction", () => {
    // Dragging right past the commit threshold in LTR → prev; in RTL → next.
    const ltr = new SwipeNavigator()
    ltr.begin(100, 100, 0)
    ltr.move(500, 100, 50)
    expect(ltr.release(W, H, "ltr").action).toBe("prev")

    const rtl = new SwipeNavigator()
    rtl.begin(100, 100, 0)
    rtl.move(500, 100, 50)
    expect(rtl.release(W, H, "rtl").action).toBe("next")

    // And the reverse — dragging left commits to next in LTR, prev in RTL.
    const rtl2 = new SwipeNavigator()
    rtl2.begin(500, 100, 0)
    rtl2.move(100, 100, 50)
    expect(rtl2.release(W, H, "rtl").action).toBe("prev")
  })

  it("locks vertical axis when vertical drift dominates", () => {
    const s = new SwipeNavigator()
    s.begin(100, 100, 0)
    expect(s.move(102, 120, 10).axis).toBe("vertical")
  })

  it("commits next when dragged left past threshold", () => {
    const s = new SwipeNavigator()
    s.begin(500, 400, 0)
    s.move(200, 402, 50)
    const r = s.release(W, H)
    expect(r.action).toBe("next")
  })

  it("commits prev when dragged right past threshold", () => {
    const s = new SwipeNavigator()
    s.begin(500, 400, 0)
    s.move(800, 402, 50)
    const r = s.release(W, H)
    expect(r.action).toBe("prev")
  })

  it("cancels short horizontal drags", () => {
    const s = new SwipeNavigator()
    s.begin(500, 400, 0)
    s.move(520, 402, 200)
    const r = s.release(W, H)
    expect(r.action).toBe("cancel")
  })

  it("flings commit even under distance threshold", () => {
    const s = new SwipeNavigator()
    s.begin(500, 400, 0)
    // 60px in 40ms = 1.5 px/ms — easily above flingVelocity 0.6.
    s.move(530, 400, 20)
    s.move(560, 400, 40)
    const r = s.release(W, H)
    expect(r.action).toBe("prev")
    expect(r.velocity).toBeGreaterThan(0.6)
  })

  it("dismisses on downward vertical drag past threshold", () => {
    const s = new SwipeNavigator()
    s.begin(500, 100, 0)
    s.move(502, 300, 50)
    const r = s.release(W, H)
    expect(r.action).toBe("dismiss")
  })

  it("cancel() aborts in-flight gesture", () => {
    const s = new SwipeNavigator()
    s.begin(0, 0, 0)
    s.move(100, 0, 10)
    s.cancel()
    expect(s.isActive).toBe(false)
    expect(s.currentAxis).toBe(null)
  })
})
