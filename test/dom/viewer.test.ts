import { beforeEach, describe, expect, it } from "vitest"

import { _resetScrollLock } from "../../src/dom/scroll-lock"
import { PencereViewer } from "../../src/dom/viewer"
import type { ImageItem } from "../../src/index"

const items: ImageItem[] = [
  { type: "image", src: "https://example.com/a.jpg", alt: "A" },
  { type: "image", src: "https://example.com/b.jpg", alt: "B", caption: "beta caption" },
  { type: "image", src: "https://example.com/c.jpg", alt: "C" },
]

// Stub Image so loadImage resolves without network.
class StubImage {
  public src = ""
  public srcset = ""
  public sizes = ""
  public alt = ""
  public width = 0
  public height = 0
  public complete = true
  public naturalWidth = 800
  public naturalHeight = 600
  public decoding = ""
  public crossOrigin: string | null = null
  public referrerPolicy = ""
  public style: { cssText: string; transform: string } = { cssText: "", transform: "" }
  addEventListener(_: string, fn: () => void): void {
    queueMicrotask(fn)
  }
  removeEventListener(): void {}
  setAttribute(): void {}
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

  it("mounts top and bottom toolbars with gradient backdrops", () => {
    const v = factory()
    const top = v.root.querySelector("[data-pc-part='toolbar-top']") as HTMLElement
    const bottom = v.root.querySelector("[data-pc-part='toolbar-bottom']") as HTMLElement
    expect(top).not.toBeNull()
    expect(bottom).not.toBeNull()
    // Close button + counter live in the top bar, caption in the bottom bar.
    expect(top.querySelector("button[aria-label]")).not.toBeNull()
    expect(bottom.querySelector("figcaption")).not.toBeNull()
    // Gradient backdrops so controls stay legible over any image.
    expect(top.style.background).toContain("linear-gradient")
    expect(bottom.style.background).toContain("linear-gradient")
    // Bars themselves are pointer-transparent; only the button reclaims clicks.
    expect(top.style.pointerEvents).toBe("none")
    expect(bottom.style.pointerEvents).toBe("none")
    v.destroy()
  })

  it("nav buttons have circular backdrop for contrast on light images", () => {
    const v = factory()
    const prev = v.root.querySelector("button[aria-label='Previous image']") as HTMLElement
    expect(prev.style.borderRadius).toBe("999px")
    expect(prev.style.background).toContain("rgba")
    v.destroy()
  })

  it("hidden by default, shown on open, hidden again on close", async () => {
    const v = factory()
    expect(v.root.style.display).toBe("none")
    await v.open()
    expect(v.root.style.display).toBe("flex")
    await v.close()
    expect(v.root.style.display).toBe("none")
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
