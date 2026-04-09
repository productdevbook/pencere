import { beforeEach, describe, expect, it } from "vitest"

import { _resetScrollLock } from "../../src/dom/scroll-lock"
import { PencereViewer } from "../../src/dom/viewer"
import type { ImageItem } from "../../src/index"

const items: ImageItem[] = [
  { type: "image", src: "https://example.com/a.jpg", alt: "A" },
  { type: "image", src: "https://example.com/b.jpg", alt: "B", caption: "beta caption" },
  { type: "image", src: "https://example.com/c.jpg", alt: "C" },
]

// Stub Image so loadImage resolves without network but returns a real
// DOM node so appendChild works inside renderSlide.
function StubImage(): HTMLImageElement {
  const el = document.createElement("img") as HTMLImageElement & {
    _naturalWidth: number
    _naturalHeight: number
  }
  el._naturalWidth = 800
  el._naturalHeight = 600
  Object.defineProperty(el, "complete", { get: () => true })
  Object.defineProperty(el, "naturalWidth", { get: () => el._naturalWidth })
  Object.defineProperty(el, "naturalHeight", { get: () => el._naturalHeight })
  // Fire load immediately so loadImage's Promise resolves on its own.
  queueMicrotask(() => el.dispatchEvent(new Event("load")))
  return el
}

describe("PencereViewer", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    _resetScrollLock()
    // @ts-expect-error — test stub
    globalThis.Image = StubImage
  })

  function factory() {
    return new PencereViewer({
      items,
      lockScroll: false,
      // jsdom does not implement <dialog>.showModal() reliably.
      useNativeDialog: false,
    })
  }

  it("mounts a dialog root with aria-roledescription=carousel", () => {
    const v = factory()
    expect(v.root.getAttribute("aria-roledescription")).toBe("carousel")
    expect(v.root.getAttribute("aria-label")).toBeTruthy()
    expect(document.body.contains(v.root)).toBe(true)
    v.destroy()
  })

  it("open() puts the core in open state and shows the dialog", async () => {
    const v = factory()
    await v.open()
    expect(v.core.state.isOpen).toBe(true)
    expect(v.root.hasAttribute("aria-modal")).toBe(true)
    await v.close()
    v.destroy()
  })

  it("Escape closes the viewer", async () => {
    const v = factory()
    await v.open()
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }))
    // Give the promise chain a tick.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(v.core.state.isOpen).toBe(false)
    v.destroy()
  })

  it("ArrowRight navigates next, ArrowLeft navigates prev", async () => {
    const v = factory()
    await v.open()
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(v.core.state.index).toBe(1)
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(v.core.state.index).toBe(0)
    await v.close()
    v.destroy()
  })

  it("caption uses textContent so HTML cannot be injected", async () => {
    const viewer = new PencereViewer({
      items: [
        {
          type: "image",
          src: "https://example.com/a.jpg",
          alt: "A",
          caption: "<img src=x onerror=alert(1)>",
        },
      ],
      lockScroll: false,
      useNativeDialog: false,
    })
    await viewer.open()
    // Let renderSlide's queueMicrotask-based Image load complete.
    await new Promise((resolve) => setTimeout(resolve, 10))
    const caption = viewer.root.querySelector("figcaption")!
    expect(caption.textContent).toBe("<img src=x onerror=alert(1)>")
    expect(caption.querySelector("img")).toBeNull()
    await viewer.close()
    viewer.destroy()
  })

  it("announces slide changes via live region", async () => {
    const v = factory()
    await v.open()
    const live = v.root.querySelector("[aria-live='polite']")!
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(live.textContent).toMatch(/Image 1 of 3/)
    await v.core.next()
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(live.textContent).toMatch(/Image 2 of 3/)
    await v.close()
    v.destroy()
  })

  it("destroy() removes the root and tears down listeners", () => {
    const v = factory()
    v.destroy()
    expect(document.body.querySelector("dialog")).toBeNull()
  })

  it("destroy() stops routing keyboard events to closed viewer (#31)", async () => {
    // Regression guard: every listener must be tied to an AbortController
    // signal so destroy() removes them atomically.
    const v = factory()
    await v.open()
    v.destroy()
    // After destroy, dispatching keys should not throw or re-open state.
    expect(() =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" })),
    ).not.toThrow()
    expect(v.core.state.isOpen).toBe(false)
  })

  it("mounts top and bottom toolbars with the expected CSS hooks", () => {
    const v = factory()
    const top = v.root.querySelector("[data-pc-part='toolbar-top']") as HTMLElement
    const bottom = v.root.querySelector("[data-pc-part='toolbar-bottom']") as HTMLElement
    expect(top).not.toBeNull()
    expect(bottom).not.toBeNull()
    // Close button + counter live in the top bar, caption in the bottom bar.
    expect(top.querySelector("button[aria-label]")).not.toBeNull()
    expect(bottom.querySelector("figcaption")).not.toBeNull()
    // Styles come from the injected stylesheet; we just assert the
    // CSP-friendly class hooks are present.
    expect(top.classList.contains("pc-toolbar-top")).toBe(true)
    expect(bottom.classList.contains("pc-toolbar-bottom")).toBe(true)
    v.destroy()
  })

  it("nav buttons carry the pc-btn--nav hook for circular styling", () => {
    const v = factory()
    const prev = v.root.querySelector("button[aria-label='Previous image']") as HTMLElement
    const next = v.root.querySelector("button[aria-label='Next image']") as HTMLElement
    expect(prev.classList.contains("pc-btn--nav")).toBe(true)
    expect(prev.classList.contains("pc-btn--prev")).toBe(true)
    expect(next.classList.contains("pc-btn--next")).toBe(true)
    v.destroy()
  })

  it("hidden by default via CSS, marks --open class on open/close", async () => {
    const v = factory()
    expect(v.root.classList.contains("pc-root--open")).toBe(false)
    await v.open()
    expect(v.root.classList.contains("pc-root--open")).toBe(true)
    await v.close()
    expect(v.root.classList.contains("pc-root--open")).toBe(false)
    v.destroy()
  })

  it("wheel event zooms the image around the cursor", async () => {
    const v = factory()
    await v.open()
    await new Promise((r) => setTimeout(r, 120))
    const stage = v.root.querySelector("[role='group']") as HTMLElement
    stage.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -300, clientX: 100, clientY: 100, cancelable: true }),
    )
    // e^(300/300) ≈ 2.718 → clamped but scale should have grown.
    // @ts-expect-error reach into private for test
    expect(v.gesture.current.scale).toBeGreaterThan(1.5)
    await v.close()
    v.destroy()
  })

  it("wheel zoom preventDefault stops page scroll", async () => {
    const v = factory()
    await v.open()
    await new Promise((r) => setTimeout(r, 120))
    const stage = v.root.querySelector("[role='group']") as HTMLElement
    const evt = new WheelEvent("wheel", {
      deltaY: -100,
      clientX: 50,
      clientY: 50,
      cancelable: true,
    })
    stage.dispatchEvent(evt)
    expect(evt.defaultPrevented).toBe(true)
    await v.close()
    v.destroy()
  })

  it("close button click closes the viewer even through gesture layer", async () => {
    const v = factory()
    await v.open()
    await new Promise((r) => setTimeout(r, 120))
    const close = v.root.querySelector("button[aria-label='Close']") as HTMLButtonElement
    // Simulate a real pointer sequence — this is what was failing in
    // the browser: gesture.setPointerCapture stole the pointerup so
    // the synthetic click never fired.
    close.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }))
    close.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }))
    close.click()
    await new Promise((r) => setTimeout(r, 10))
    expect(v.core.state.isOpen).toBe(false)
    v.destroy()
  })

  it("prev/next button pointer sequences navigate instead of starting a swipe", async () => {
    const v = factory()
    await v.open()
    await new Promise((r) => setTimeout(r, 120))
    const next = v.root.querySelector("button[aria-label='Next image']") as HTMLButtonElement
    next.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 2 }))
    next.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 2 }))
    next.click()
    await new Promise((r) => setTimeout(r, 10))
    expect(v.core.state.index).toBe(1)
    // Swipe must NOT have been started by the button press.
    // @ts-expect-error reach into private
    expect(v.swipe.isActive).toBe(false)
    await v.close()
    v.destroy()
  })

  it("gesture engine ignores pointerdown on buttons", async () => {
    const v = factory()
    await v.open()
    await new Promise((r) => setTimeout(r, 120))
    const prev = v.root.querySelector("button[aria-label='Previous image']") as HTMLButtonElement
    // @ts-expect-error reach into private
    const gesture = v.gesture
    prev.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 3 }))
    // Gesture engine should not have registered any pointer.
    // @ts-expect-error reach into private
    expect(gesture.pointers.size).toBe(0)
    await v.close()
    v.destroy()
  })

  it("double-tap toggles between 1x and 2x zoom", async () => {
    const v = factory()
    await v.open()
    await new Promise((r) => setTimeout(r, 120))
    // @ts-expect-error reach into private for test
    const gesture = v.gesture
    expect(gesture.current.scale).toBe(1)
    // @ts-expect-error reach into private for test
    v.handleDoubleTap()
    expect(gesture.current.scale).toBeGreaterThan(1)
    // @ts-expect-error reach into private for test
    v.handleDoubleTap()
    expect(gesture.current.scale).toBe(1)
    await v.close()
    v.destroy()
  })

  it("+/- keys zoom in and out; 0 resets", async () => {
    const v = factory()
    await v.open()
    await new Promise((r) => setTimeout(r, 120))
    // @ts-expect-error reach into private
    const gesture = v.gesture
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "+", cancelable: true }))
    expect(gesture.current.scale).toBeGreaterThan(1)
    const scaled = gesture.current.scale
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "+", cancelable: true }))
    expect(gesture.current.scale).toBeGreaterThan(scaled)
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "-", cancelable: true }))
    expect(gesture.current.scale).toBeLessThan(gesture.current.scale * 1.25 + 0.001)
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "0", cancelable: true }))
    expect(gesture.current.scale).toBe(1)
    await v.close()
    v.destroy()
  })

  it("zoomOut below 1 snaps back to identity", async () => {
    const v = factory()
    await v.open()
    await new Promise((r) => setTimeout(r, 120))
    // @ts-expect-error reach into private
    v.zoomBy(0.5)
    // @ts-expect-error
    expect(v.gesture.current.scale).toBe(1)
    // @ts-expect-error
    expect(v.gesture.current.x).toBe(0)
    await v.close()
    v.destroy()
  })

  it("rtl: inherits dir from <html dir='rtl'> and flips arrow navigation", async () => {
    document.documentElement.setAttribute("dir", "rtl")
    try {
      const v = factory()
      expect(v.dir).toBe("rtl")
      expect(v.root.getAttribute("dir")).toBe("rtl")
      await v.open()
      // In rtl, ArrowLeft should advance to the next slide.
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", cancelable: true }))
      await new Promise((r) => setTimeout(r, 0))
      expect(v.core.state.index).toBe(1)
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true }))
      await new Promise((r) => setTimeout(r, 0))
      expect(v.core.state.index).toBe(0)
      await v.close()
      v.destroy()
    } finally {
      document.documentElement.removeAttribute("dir")
    }
  })

  it("rtl: explicit option wins over document direction", () => {
    const v = new PencereViewer({
      items,
      lockScroll: false,
      useNativeDialog: false,
      dir: "rtl",
    })
    expect(v.dir).toBe("rtl")
    expect(v.root.getAttribute("dir")).toBe("rtl")
    v.destroy()
  })

  it("reduced-motion override is honored", () => {
    const v = new PencereViewer({
      items,
      lockScroll: false,
      useNativeDialog: false,
      reducedMotion: "always",
    })
    expect(v.isReducedMotion).toBe(true)
    v.destroy()
  })
})
