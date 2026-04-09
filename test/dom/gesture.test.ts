import { beforeEach, describe, expect, it, vi } from "vitest";
import { GestureEngine } from "../../src/dom/gesture";

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
  } as PointerEventInit);
  Object.defineProperty(e, "pointerId", { value: id });
  Object.defineProperty(e, "timeStamp", { value: timeStamp });
  if (type === "pointermove") {
    // movementX/Y are zero by default in jsdom — compute from previous.
    Object.defineProperty(e, "movementX", { value: 0, writable: true });
    Object.defineProperty(e, "movementY", { value: 0, writable: true });
  }
  return e as unknown as PointerEvent;
}

function move(
  id: number,
  x: number,
  y: number,
  movementX: number,
  movementY: number,
  timeStamp = 0,
): PointerEvent {
  const e = ptr(id, x, y, "pointermove", timeStamp);
  Object.defineProperty(e, "movementX", { value: movementX });
  Object.defineProperty(e, "movementY", { value: movementY });
  return e;
}

describe("GestureEngine", () => {
  let el: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = "";
    el = document.createElement("div");
    document.body.appendChild(el);
    // jsdom lacks setPointerCapture — stub so the engine doesn't throw.
    (el as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = () => {};
  });

  it("sets touch-action:none on the element", () => {
    new GestureEngine(el);
    expect(el.style.touchAction).toBe("none");
  });

  it("emits start → pan → end for a single-pointer drag", () => {
    const events: string[] = [];
    const g = new GestureEngine(el, { onUpdate: (s) => events.push(s.type) });
    g.attach();
    g.handleDown(ptr(1, 0, 0, "pointerdown"));
    g.handleMove(move(1, 10, 0, 10, 0));
    g.handleUp(ptr(1, 10, 0, "pointerup", 500));
    expect(events).toEqual(["start", "pan", "end"]);
    expect(g.current.x).toBe(10);
  });

  it("pan translation accumulates per-move delta", () => {
    const g = new GestureEngine(el);
    g.handleDown(ptr(1, 0, 0, "pointerdown"));
    g.handleMove(move(1, 5, 0, 5, 0));
    g.handleMove(move(1, 15, 10, 10, 10));
    expect(g.current.x).toBe(15);
    expect(g.current.y).toBe(10);
  });

  it("pinch: two pointers scale up the transform", () => {
    const g = new GestureEngine(el, { minScale: 0.1, maxScale: 100 });
    g.handleDown(ptr(1, 100, 100, "pointerdown"));
    g.handleDown(ptr(2, 200, 100, "pointerdown"));
    // initial distance = 100
    // spread symmetrically so the new distance is 200 across two moves
    g.handleMove(move(1, 50, 100, 0, 0));
    g.handleMove(move(2, 250, 100, 0, 0));
    // The cumulative scale across both frames should be ~2.
    expect(g.current.scale).toBeCloseTo(2, 1);
  });

  it("pinch: single synchronous frame preserves the centroid", () => {
    // Drive the math directly without the two-phase event ordering of
    // real Pointer Events: register both pointers, move one in-place,
    // and verify the centroid math holds when only one distance step
    // is taken.
    const g = new GestureEngine(el, { minScale: 0.1, maxScale: 100 });
    g.handleDown(ptr(1, 100, 100, "pointerdown"));
    g.handleDown(ptr(2, 200, 100, "pointerdown"));
    // Move pointer 1 to (50, 100); now distance = 150 and centroid = (125, 100)
    g.handleMove(move(1, 50, 100, 0, 0));
    // scale factor = 150 / 100 = 1.5
    expect(g.current.scale).toBeCloseTo(1.5);
    // The centroid (125, 100) should still map to itself
    const img = { x: 125, y: 100 };
    expect(img.x * g.current.scale + g.current.x).toBeCloseTo(125);
    expect(img.y * g.current.scale + g.current.y).toBeCloseTo(100);
  });

  it("pinch respects minScale / maxScale", () => {
    const g = new GestureEngine(el, { minScale: 1, maxScale: 1.5 });
    g.handleDown(ptr(1, 100, 100, "pointerdown"));
    g.handleDown(ptr(2, 200, 100, "pointerdown"));
    g.handleMove(move(1, 0, 100, 0, 0));
    g.handleMove(move(2, 300, 100, 0, 0)); // distance tripled → k=3
    expect(g.current.scale).toBe(1.5);
  });

  it("emits tap for a short, motionless pointer up", () => {
    const events: string[] = [];
    const g = new GestureEngine(el, { onUpdate: (s) => events.push(s.type) });
    g.handleDown(ptr(1, 10, 10, "pointerdown", 0));
    g.handleUp(ptr(1, 10, 10, "pointerup", 100));
    expect(events).toContain("tap");
  });

  it("does NOT emit tap when moved beyond threshold", () => {
    const events: string[] = [];
    const g = new GestureEngine(el, { onUpdate: (s) => events.push(s.type) });
    g.handleDown(ptr(1, 10, 10, "pointerdown", 0));
    g.handleMove(move(1, 30, 10, 20, 0));
    g.handleUp(ptr(1, 30, 10, "pointerup", 100));
    expect(events).not.toContain("tap");
  });

  it("emits doubleTap for two quick taps at the same location", () => {
    const events: string[] = [];
    const g = new GestureEngine(el, { onUpdate: (s) => events.push(s.type) });
    g.handleDown(ptr(1, 10, 10, "pointerdown", 0));
    g.handleUp(ptr(1, 10, 10, "pointerup", 50));
    g.handleDown(ptr(2, 12, 11, "pointerdown", 150));
    g.handleUp(ptr(2, 12, 11, "pointerup", 200));
    expect(events.filter((e) => e === "doubleTap").length).toBe(1);
  });

  it("reset() returns transform to identity", () => {
    const g = new GestureEngine(el);
    g.handleDown(ptr(1, 0, 0, "pointerdown"));
    g.handleMove(move(1, 50, 50, 50, 50));
    g.reset();
    expect(g.current).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it("attach / detach add and remove listeners", () => {
    const add = vi.spyOn(el, "addEventListener");
    const remove = vi.spyOn(el, "removeEventListener");
    const g = new GestureEngine(el);
    g.attach();
    expect(add).toHaveBeenCalled();
    g.detach();
    expect(remove).toHaveBeenCalled();
  });
});
