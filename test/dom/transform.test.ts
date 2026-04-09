import { describe, expect, it } from "vitest"

import {
  clampScale,
  distance,
  IDENTITY,
  midpoint,
  scaleAround,
  toCss,
  translate,
} from "../../src/dom/transform"

describe("transform math", () => {
  it("IDENTITY is zero translate, scale 1", () => {
    expect(IDENTITY).toEqual({ x: 0, y: 0, scale: 1 })
  })

  it("translate() adds delta", () => {
    expect(translate(IDENTITY, 10, 20)).toEqual({ x: 10, y: 20, scale: 1 })
  })

  it("clampScale() honors both bounds", () => {
    expect(clampScale({ x: 0, y: 0, scale: 0.5 }, 1, 8)).toEqual({ x: 0, y: 0, scale: 1 })
    expect(clampScale({ x: 0, y: 0, scale: 12 }, 1, 8)).toEqual({ x: 0, y: 0, scale: 8 })
    expect(clampScale({ x: 0, y: 0, scale: 3 }, 1, 8)).toEqual({ x: 0, y: 0, scale: 3 })
  })

  describe("scaleAround()", () => {
    it("scaling around origin behaves like plain scale on origin", () => {
      const out = scaleAround(IDENTITY, 2, 0, 0)
      expect(out).toEqual({ x: 0, y: 0, scale: 2 })
    })

    it("preserves the screen position of the anchor point", () => {
      // Start with identity. Pick anchor (100, 50). Map this screen point
      // back to image coordinates via inverse, scale by 2, re-map forward,
      // verify it lands back at (100, 50).
      const anchor = { x: 100, y: 50 }
      const out = scaleAround(IDENTITY, 2, anchor.x, anchor.y)
      // Forward map of the original image pixel that was at `anchor`:
      // image_px = (anchor - {x,y}) / scale = (100, 50)
      // After new transform: new_screen = image_px * newScale + {newX, newY}
      const imgPx = { x: anchor.x, y: anchor.y }
      const newScreen = {
        x: imgPx.x * out.scale + out.x,
        y: imgPx.y * out.scale + out.y,
      }
      expect(newScreen.x).toBeCloseTo(anchor.x)
      expect(newScreen.y).toBeCloseTo(anchor.y)
    })

    it("repeated scaling around same point keeps anchor fixed", () => {
      let t = IDENTITY
      const anchor = { x: 200, y: 120 }
      for (let i = 0; i < 5; i++) t = scaleAround(t, 1.2, anchor.x, anchor.y)
      const imgPx = { x: anchor.x, y: anchor.y }
      const screen = {
        x: imgPx.x * t.scale + t.x,
        y: imgPx.y * t.scale + t.y,
      }
      expect(screen.x).toBeCloseTo(anchor.x)
      expect(screen.y).toBeCloseTo(anchor.y)
    })
  })

  it("midpoint() is the geometric mean", () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 })
  })

  it("distance() is euclidean", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it("toCss() uses translate3d for GPU compositing", () => {
    const css = toCss({ x: 1, y: 2, scale: 1.5 })
    expect(css).toContain("translate3d(1.00px, 2.00px, 0)")
    expect(css).toContain("scale(1.5000)")
  })
})
