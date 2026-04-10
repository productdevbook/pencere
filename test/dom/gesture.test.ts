import { beforeEach, describe, expect, it, vi } from "vitest"

import { GestureEngine } from "../../src/dom/gesture"

function ptr(
  id: number,
  x: number,
  y: number,
  type: "pointerdown" | "pointermove" | "pointerup" = "pointermove",
  timeStamp = 0,
): PointerEvent {
  // jsdom exposes PointerEvent as a subclass of Event.
  const e = new (globalThis as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent(type, {
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
  } as PointerEventInit)
  Object.defineProperty(e, "pointerId", { value: id })
  Object.defineProperty(e, "timeStamp", { value: timeStamp })
  if (type === "pointermove") {
    // movementX/Y are zero by default in jsdom — compute from previous.
    Object.defineProperty(e, "movementX", { value: 0, writable: true })
    Object.defineProperty(e, "movementY", { value: 0, writable: true })
  }
  return e as unknown as PointerEvent
}

function move(
  id: number,
  x: number,
  y: number,
  movementX: number,
  movementY: number,
  timeStamp = 0,
): PointerEvent {
  const e = ptr(id, x, y, "pointermove", timeStamp)
  Object.defineProperty(e, "movementX", { value: movementX })
  Object.defineProperty(e, "movementY", { value: movementY })
  return e
}

describe("GestureEngine pinch chaining + re-grip (#45)", () => {
  let el: HTMLElement
  beforeEach(() => {
    document.body.innerHTML = ""
    el = document.createElement("div")
    document.body.appendChild(el)
    ;(el as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = () => {}
  })

  it("accumulates scale across successive pinch gestures", () => {
    const g = new GestureEngine(el)
    // First pinch: spread from 100px to 200px → scale ×2.
    g.handleDown(ptr(1, 0, 0, "pointerdown"))
    g.handleDown(ptr(2, 100, 0, "pointerdown"))
    g.handleMove(move(2, 200, 0, 100, 0))
    g.flushPendingEmit()
    g.handleUp(ptr(1, 0, 0, "pointerup"))
    g.handleUp(ptr(2, 200, 0, "pointerup"))
    const afterFirst = g.current.scale
    expect(afterFirst).toBeGreaterThan(1.5)
    // Second pinch starts fresh, chaining on top of the first transform.
    g.handleDown(ptr(3, 0, 0, "pointerdown"))
    g.handleDown(ptr(4, 100, 0, "pointerdown"))
    g.handleMove(move(4, 200, 0, 100, 0))
    g.flushPendingEmit()
    g.handleUp(ptr(3, 0, 0, "pointerup"))
    g.handleUp(ptr(4, 200, 0, "pointerup"))
    expect(g.current.scale).toBeGreaterThan(afterFirst)
  })

  it("re-grip: releasing one finger mid-pinch does not jump the pan", () => {
    const events: Array<{ type: string; delta?: { dx: number; dy: number } }> = []
    const g = new GestureEngine(el, {
      onUpdate: (s) => events.push({ type: s.type, delta: s.delta }),
    })
    g.handleDown(ptr(1, 0, 0, "pointerdown"))
    g.handleDown(ptr(2, 100, 0, "pointerdown"))
    // Pinch a bit.
    g.handleMove(move(2, 150, 0, 50, 0))
    g.flushPendingEmit()
    // Lift one finger — we are now in pan mode with a single pointer.
    g.handleUp(ptr(2, 150, 0, "pointerup"))
    const panBeforeJump = events.filter((e) => e.type === "pan").length
    // Re-anchored: the next handleMove with movement=(0,0) must not
    // produce any new pan delta at all.
    g.handleMove(move(1, 0, 0, 0, 0))
    g.flushPendingEmit()
    // Zero-delta moves still emit a pan frame but the delta is (0,0).
    const pans = events.filter((e) => e.type === "pan")
    const fresh = pans.slice(panBeforeJump)
    for (const p of fresh) {
      expect(p.delta).toEqual({ dx: 0, dy: 0 })
    }
  })
})

describe("GestureEngine rAF throttle (#34)", () => {
  let el: HTMLElement
  let rafQueue: FrameRequestCallback[] = []
  let originalRaf: typeof requestAnimationFrame
  let originalCaf: typeof cancelAnimationFrame

  beforeEach(() => {
    document.body.innerHTML = ""
    el = document.createElement("div")
    document.body.appendChild(el)
    ;(el as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = () => {}
    // Replace rAF with a synchronous queue so the test can step frames.
    rafQueue = []
    originalRaf = globalThis.requestAnimationFrame
    originalCaf = globalThis.cancelAnimationFrame
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
      rafQueue.push(cb)
      return rafQueue.length
    }) as typeof requestAnimationFrame
    globalThis.cancelAnimationFrame = ((id: number): void => {
      // Clear the slot but keep indices stable.
      rafQueue[id - 1] = (): void => {}
    }) as typeof cancelAnimationFrame
  })

  function flushFrame(): void {
    const q = rafQueue
    rafQueue = []
    for (const cb of q) cb(performance.now())
  }

  it("coalesces six pointermoves inside one frame into a single emit", () => {
    const events: Array<{ type: string; delta?: { dx: number; dy: number } }> = []
    const g = new GestureEngine(el, {
      onUpdate: (s) => events.push({ type: s.type, delta: s.delta }),
    })
    g.handleDown(ptr(1, 0, 0, "pointerdown"))
    // Six sub-frame pan events.
    for (let i = 0; i < 6; i++) g.handleMove(move(1, (i + 1) * 10, 0, 10, 0))
    // No pan emitted yet (rAF not run).
    expect(events.filter((e) => e.type === "pan").length).toBe(0)
    flushFrame()
    const pans = events.filter((e) => e.type === "pan")
    // Exactly one pan — and its delta is the sum of the six individual moves.
    expect(pans.length).toBe(1)
    expect(pans[0]!.delta).toEqual({ dx: 60, dy: 0 })
    // Teardown for later suites.
    globalThis.requestAnimationFrame = originalRaf
    globalThis.cancelAnimationFrame = originalCaf
  })

  it("pointerup flushes any pending emit synchronously", () => {
    const types: string[] = []
    const g = new GestureEngine(el, { onUpdate: (s) => types.push(s.type) })
    g.handleDown(ptr(1, 0, 0, "pointerdown"))
    g.handleMove(move(1, 5, 5, 5, 5))
    // rAF hasn't run — but pointerup must drain the queue before "end".
    g.handleUp(ptr(1, 5, 5, "pointerup"))
    const panIdx = types.indexOf("pan")
    const endIdx = types.indexOf("end")
    expect(panIdx).toBeGreaterThanOrEqual(0)
    expect(endIdx).toBeGreaterThan(panIdx)
    globalThis.requestAnimationFrame = originalRaf
    globalThis.cancelAnimationFrame = originalCaf
  })

  it("detach() cancels a pending frame", () => {
    const types: string[] = []
    const g = new GestureEngine(el, { onUpdate: (s) => types.push(s.type) })
    g.attach()
    g.handleDown(ptr(1, 0, 0, "pointerdown"))
    g.handleMove(move(1, 5, 5, 5, 5))
    g.detach()
    flushFrame()
    expect(types).not.toContain("pan")
    globalThis.requestAnimationFrame = originalRaf
    globalThis.cancelAnimationFrame = originalCaf
  })
})

describe("GestureEngine", () => {
  let el: HTMLElement
  beforeEach(() => {
    document.body.innerHTML = ""
    el = document.createElement("div")
    document.body.appendChild(el)
    // jsdom lacks setPointerCapture — stub so the engine doesn't throw.
    ;(el as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = () => {}
  })

  it("sets touch-action:none on the element", () => {
    new GestureEngine(el)
    expect(el.style.touchAction).toBe("none")
  })

  it("emits start → pan → end for a single-pointer drag", () => {
    const events: string[] = []
    const g = new GestureEngine(el, { onUpdate: (s) => events.push(s.type) })
    g.attach()
    g.handleDown(ptr(1, 0, 0, "pointerdown"))
    g.handleMove(move(1, 10, 0, 10, 0))
    g.handleUp(ptr(1, 10, 0, "pointerup", 500))
    expect(events).toEqual(["start", "pan", "end"])
    expect(g.current.x).toBe(10)
  })

  it("pan translation accumulates per-move delta", () => {
    const g = new GestureEngine(el)
    g.handleDown(ptr(1, 0, 0, "pointerdown"))
    g.handleMove(move(1, 5, 0, 5, 0))
    g.handleMove(move(1, 15, 10, 10, 10))
    expect(g.current.x).toBe(15)
    expect(g.current.y).toBe(10)
  })

  it("pinch: two pointers scale up the transform", () => {
    const g = new GestureEngine(el, { minScale: 0.1, maxScale: 100 })
    g.handleDown(ptr(1, 100, 100, "pointerdown"))
    g.handleDown(ptr(2, 200, 100, "pointerdown"))
    // initial distance = 100
    // spread symmetrically so the new distance is 200 across two moves
    g.handleMove(move(1, 50, 100, 0, 0))
    g.handleMove(move(2, 250, 100, 0, 0))
    // The cumulative scale across both frames should be ~2.
    expect(g.current.scale).toBeCloseTo(2, 1)
  })

  it("pinch: single synchronous frame preserves the centroid", () => {
    // Drive the math directly without the two-phase event ordering of
    // real Pointer Events: register both pointers, move one in-place,
    // and verify the centroid math holds when only one distance step
    // is taken.
    const g = new GestureEngine(el, { minScale: 0.1, maxScale: 100 })
    g.handleDown(ptr(1, 100, 100, "pointerdown"))
    g.handleDown(ptr(2, 200, 100, "pointerdown"))
    // Move pointer 1 to (50, 100); now distance = 150 and centroid = (125, 100)
    g.handleMove(move(1, 50, 100, 0, 0))
    // scale factor = 150 / 100 = 1.5
    expect(g.current.scale).toBeCloseTo(1.5)
    // The centroid (125, 100) should still map to itself
    const img = { x: 125, y: 100 }
    expect(img.x * g.current.scale + g.current.x).toBeCloseTo(125)
    expect(img.y * g.current.scale + g.current.y).toBeCloseTo(100)
  })

  it("pinch: zooms around finger midpoint with non-zero element rect", () => {
    // Regression: when getBoundingClientRect returns a realistic rect
    // (i.e. the element center is NOT at viewport (0,0)), the pinch
    // must still keep the finger midpoint visually stationary.
    // Previously scaleAround received raw client coords, causing a
    // drift toward bottom-right on real devices.
    const stageRect = {
      left: 0,
      top: 80,
      width: 390,
      height: 680,
      right: 390,
      bottom: 760,
      x: 0,
      y: 80,
    }
    el.getBoundingClientRect = () => stageRect as DOMRect

    const g = new GestureEngine(el, { minScale: 0.1, maxScale: 100 })
    // Two fingers at (100, 350) and (300, 350) → distance 200, midpoint (200, 350)
    g.handleDown(ptr(1, 100, 350, "pointerdown"))
    g.handleDown(ptr(2, 300, 350, "pointerdown"))
    // Move only p2 to (500, 350) → distance 400 → k=2, midpoint (300, 350)
    g.handleMove(move(2, 500, 350, 0, 0))
    g.flushPendingEmit()

    const { x: tx, y: ty, scale } = g.current
    expect(scale).toBeCloseTo(2, 1)

    // The midpoint of THIS move — (300, 350) — should stay fixed in
    // viewport space. With transform-origin:center the viewport pos
    // of element-local (lx, ly) is:
    //   rect.left + cxLocal + tx + scale * (lx - cxLocal)
    const mx = 300
    const my = 350
    const lx = mx - stageRect.left
    const ly = my - stageRect.top
    const cxLocal = stageRect.width / 2
    const cyLocal = stageRect.height / 2
    const renderedX = stageRect.left + cxLocal + tx + scale * (lx - cxLocal)
    const renderedY = stageRect.top + cyLocal + ty + scale * (ly - cyLocal)
    expect(renderedX).toBeCloseTo(mx, 0)
    expect(renderedY).toBeCloseTo(my, 0)
  })

  it("pinch respects minScale / maxScale", () => {
    const g = new GestureEngine(el, { minScale: 1, maxScale: 1.5 })
    g.handleDown(ptr(1, 100, 100, "pointerdown"))
    g.handleDown(ptr(2, 200, 100, "pointerdown"))
    g.handleMove(move(1, 0, 100, 0, 0))
    g.handleMove(move(2, 300, 100, 0, 0)) // distance tripled → k=3
    expect(g.current.scale).toBe(1.5)
  })

  it("emits tap for a short, motionless pointer up", () => {
    const events: string[] = []
    const g = new GestureEngine(el, { onUpdate: (s) => events.push(s.type) })
    g.handleDown(ptr(1, 10, 10, "pointerdown", 0))
    g.handleUp(ptr(1, 10, 10, "pointerup", 100))
    expect(events).toContain("tap")
  })

  it("does NOT emit tap when moved beyond threshold", () => {
    const events: string[] = []
    const g = new GestureEngine(el, { onUpdate: (s) => events.push(s.type) })
    g.handleDown(ptr(1, 10, 10, "pointerdown", 0))
    g.handleMove(move(1, 30, 10, 20, 0))
    g.handleUp(ptr(1, 30, 10, "pointerup", 100))
    expect(events).not.toContain("tap")
  })

  it("emits doubleTap for two quick taps at the same location", () => {
    const events: string[] = []
    const g = new GestureEngine(el, { onUpdate: (s) => events.push(s.type) })
    g.handleDown(ptr(1, 10, 10, "pointerdown", 0))
    g.handleUp(ptr(1, 10, 10, "pointerup", 50))
    g.handleDown(ptr(2, 12, 11, "pointerdown", 150))
    g.handleUp(ptr(2, 12, 11, "pointerup", 200))
    expect(events.filter((e) => e === "doubleTap").length).toBe(1)
  })

  it("reset() returns transform to identity", () => {
    const g = new GestureEngine(el)
    g.handleDown(ptr(1, 0, 0, "pointerdown"))
    g.handleMove(move(1, 50, 50, 50, 50))
    g.reset()
    expect(g.current).toEqual({ x: 0, y: 0, scale: 1 })
  })

  it("attach / detach add and remove listeners", () => {
    const add = vi.spyOn(el, "addEventListener")
    const remove = vi.spyOn(el, "removeEventListener")
    const g = new GestureEngine(el)
    g.attach()
    expect(add).toHaveBeenCalled()
    g.detach()
    expect(remove).toHaveBeenCalled()
  })
})
