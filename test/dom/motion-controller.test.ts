import { beforeEach, describe, expect, it, vi } from "vitest"

import { MotionController } from "../../src/dom/motion-controller"
import type { MotionControllerOptions } from "../../src/dom/motion-controller"
import { IDENTITY } from "../../src/dom/transform"

function setup() {
  const root = document.createElement("div")
  const stage = document.createElement("div")
  const img = document.createElement("img")
  document.body.appendChild(root)
  root.appendChild(stage)
  // stub setPointerCapture for gesture engine
  ;(stage as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {}

  const haptics = { fire: vi.fn() }
  const onNext = vi.fn()
  const onPrev = vi.fn()
  const onDismiss = vi.fn()

  let currentImg: HTMLImageElement | null = img
  const opts: MotionControllerOptions = {
    root,
    stage,
    getCurrentImg: () => currentImg,
    getDirection: () => "ltr",
    haptics: haptics as unknown as MotionControllerOptions["haptics"],
    onNext,
    onPrev,
    onDismiss,
  }
  const mc = new MotionController(opts)

  // Fake prefers-reduced-motion so zoom animations are synchronous.
  globalThis.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof matchMedia

  return {
    mc,
    root,
    stage,
    img,
    haptics,
    onNext,
    onPrev,
    onDismiss,
    setImg: (i: HTMLImageElement | null) => {
      currentImg = i
    },
  }
}

describe("MotionController", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("engage/disengage attaches and detaches gesture engine", () => {
    const { mc } = setup()
    mc.engage()
    expect(mc.gesture).toBeDefined()
    mc.disengage()
    // After disengage, scale should be reset to identity
    expect(mc.scale).toBe(1)
  })

  it("panBy moves translation when zoomed in", () => {
    const { mc, img } = setup()
    mc.engage()
    // First zoom in so panBy is active (only works at scale > 1)
    mc.zoomBy(2)
    expect(mc.scale).toBe(2)
    mc.panBy(10, 20)
    const transform = mc.gesture.current
    expect(transform.x).not.toBe(0)
    expect(transform.y).not.toBe(0)
    mc.disengage()
  })

  it("panBy is a no-op at scale=1", () => {
    const { mc } = setup()
    mc.engage()
    mc.panBy(10, 20)
    expect(mc.gesture.current).toEqual(IDENTITY)
    mc.disengage()
  })

  it("panBy is a no-op when no image", () => {
    const { mc, setImg } = setup()
    mc.engage()
    setImg(null)
    mc.zoomBy(2) // no-op since img is null
    mc.panBy(10, 20)
    expect(mc.gesture.current).toEqual(IDENTITY)
    mc.disengage()
  })

  it("zoomBy increases scale", () => {
    const { mc } = setup()
    mc.engage()
    mc.zoomBy(2)
    expect(mc.scale).toBe(2)
    mc.zoomBy(1.5)
    expect(mc.scale).toBe(3)
    mc.disengage()
  })

  it("zoomBy clamps to max 8", () => {
    const { mc } = setup()
    mc.engage()
    mc.zoomBy(10)
    expect(mc.scale).toBe(8)
    mc.disengage()
  })

  it("zoomBy below 1 snaps to identity", () => {
    const { mc } = setup()
    mc.engage()
    mc.zoomBy(2)
    mc.zoomBy(0.3)
    expect(mc.scale).toBe(1)
    expect(mc.gesture.current).toEqual(IDENTITY)
    mc.disengage()
  })

  it("zoomReset returns to identity with animation (reduced-motion = sync)", () => {
    const { mc } = setup()
    mc.engage()
    mc.zoomBy(4)
    expect(mc.scale).toBe(4)
    mc.zoomReset()
    // With prefers-reduced-motion mocked, reset is synchronous
    expect(mc.scale).toBe(1)
    mc.disengage()
  })

  it("zoomReset is a no-op at scale=1", () => {
    const { mc } = setup()
    mc.engage()
    mc.zoomReset()
    expect(mc.scale).toBe(1)
    mc.disengage()
  })

  it("writeImgTransform writes CSS custom property", () => {
    const { mc, img } = setup()
    mc.writeImgTransform({ x: 10, y: 20, scale: 2 })
    expect(img.style.getPropertyValue("--pc-img-transform")).toContain("translate3d")
    expect(img.style.getPropertyValue("--pc-img-transform")).toContain("scale")
  })

  it("writeImgTransformRaw writes raw CSS string", () => {
    const { mc, img } = setup()
    mc.writeImgTransformRaw("translate3d(5px, 5px, 0)")
    expect(img.style.getPropertyValue("--pc-img-transform")).toBe("translate3d(5px, 5px, 0)")
  })

  it("applyCurrentTransform sets transform on new img", () => {
    const { mc } = setup()
    mc.engage()
    mc.zoomBy(3)
    const newImg = document.createElement("img")
    mc.applyCurrentTransform(newImg)
    expect(newImg.style.getPropertyValue("--pc-img-transform")).toContain("scale")
    mc.disengage()
  })

  it("cancelMomentum is safe to call without running momentum", () => {
    const { mc } = setup()
    // Should not throw
    mc.cancelMomentum()
  })

  it("[Symbol.dispose] calls disengage", () => {
    const { mc } = setup()
    mc.engage()
    mc[Symbol.dispose]()
    expect(mc.scale).toBe(1)
  })

  it("scale getter returns current gesture scale", () => {
    const { mc } = setup()
    expect(mc.scale).toBe(1)
    mc.engage()
    mc.zoomBy(3)
    expect(mc.scale).toBe(3)
    mc.disengage()
  })
})
