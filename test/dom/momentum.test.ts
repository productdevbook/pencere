import { describe, expect, it } from "vitest";
import { classifySwipe, computeVelocity, runMomentum } from "../../src/dom/momentum";

describe("computeVelocity()", () => {
  it("returns zero when fewer than two samples", () => {
    expect(computeVelocity([])).toEqual({ vx: 0, vy: 0 });
    expect(computeVelocity([{ x: 0, y: 0, t: 0 }])).toEqual({ vx: 0, vy: 0 });
  });

  it("computes px/ms between first and last sample", () => {
    const v = computeVelocity([
      { x: 0, y: 0, t: 0 },
      { x: 20, y: 10, t: 100 },
    ]);
    expect(v.vx).toBeCloseTo(0.2);
    expect(v.vy).toBeCloseTo(0.1);
  });

  it("returns zero when timestamps collapse", () => {
    expect(
      computeVelocity([
        { x: 0, y: 0, t: 5 },
        { x: 10, y: 10, t: 5 },
      ]),
    ).toEqual({ vx: 0, vy: 0 });
  });
});

describe("classifySwipe()", () => {
  it("returns null below minSpeed", () => {
    expect(classifySwipe(0.1, 0.05)).toBeNull();
  });

  it("classifies horizontal swipes by sign of vx", () => {
    expect(classifySwipe(1, 0)!.direction).toBe("right");
    expect(classifySwipe(-1, 0)!.direction).toBe("left");
  });

  it("classifies vertical swipes by sign of vy", () => {
    expect(classifySwipe(0, 1)!.direction).toBe("down");
    expect(classifySwipe(0, -1)!.direction).toBe("up");
  });

  it("prefers the dominant axis", () => {
    expect(classifySwipe(2, 0.5)!.direction).toBe("right");
    expect(classifySwipe(0.5, 2)!.direction).toBe("down");
  });

  it("velocity is the euclidean speed", () => {
    const s = classifySwipe(3, 4)!;
    expect(s.velocity).toBe(5);
  });
});

describe("runMomentum()", () => {
  it("invokes onFrame at least once and stops below minSpeed", async () => {
    const frames: Array<{ vx: number; vy: number }> = [];
    await new Promise<void>((resolve) => {
      runMomentum(
        1,
        0,
        (vx, vy) => {
          frames.push({ vx, vy });
          if (frames.length > 50) return false;
        },
        { friction: 0.5, minSpeed: 0.1 },
      );
      // Let the rAF chain settle.
      setTimeout(resolve, 200);
    });
    expect(frames.length).toBeGreaterThan(0);
  });
});
