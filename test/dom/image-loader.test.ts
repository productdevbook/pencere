import { beforeEach, describe, expect, it } from "vitest"

import { computeAspectRatio, loadImage } from "../../src/dom/image-loader"
import type { ImageItem } from "../../src/index"

describe("computeAspectRatio()", () => {
  it("returns w/h when both are present", () => {
    expect(computeAspectRatio({ width: 1600, height: 900 })).toBe("1600 / 900")
  })

  it("falls back to 3/2 when unknown", () => {
    expect(computeAspectRatio({})).toBe("3 / 2")
  })

  it("falls back to 3/2 when width is 0", () => {
    expect(computeAspectRatio({ width: 0, height: 10 })).toBe("3 / 2")
  })
})

describe("loadImage()", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("rejects unsafe src (javascript:)", async () => {
    const item: ImageItem = { type: "image", src: "javascript:alert(1)" }
    await expect(loadImage(item, new AbortController().signal)).rejects.toThrow(/unsafe/)
  })

  it("applies alt, srcset, sizes, and fetchpriority", async () => {
    // Stub Image to fire load synchronously
    const origImage = globalThis.Image
    class StubImage {
      public src = ""
      public srcset = ""
      public sizes = ""
      public alt = ""
      public width = 0
      public height = 0
      public complete = true
      public naturalWidth = 100
      public naturalHeight = 50
      public decoding = ""
      public crossOrigin: string | null = null
      public referrerPolicy = ""
      private attrs: Record<string, string> = {}
      addEventListener(_: string, fn: () => void): void {
        queueMicrotask(fn)
      }
      removeEventListener(): void {}
      setAttribute(k: string, v: string): void {
        this.attrs[k] = v
      }
      getAttribute(k: string): string | null {
        return this.attrs[k] ?? null
      }
    }
    // @ts-expect-error — test stub
    globalThis.Image = StubImage
    try {
      const item: ImageItem = {
        type: "image",
        src: "https://example.com/a.jpg",
        alt: "alt text",
        srcset: "a.jpg 1x",
        sizes: "100vw",
      }
      const result = await loadImage(item, new AbortController().signal, { priority: "high" })
      expect(result.width).toBe(100)
      expect(result.height).toBe(50)
      const img = result.element as unknown as StubImage
      expect(img.alt).toBe("alt text")
      expect(img.srcset).toBe("a.jpg 1x")
      expect(img.sizes).toBe("100vw")
      expect(img.getAttribute("fetchpriority")).toBe("high")
      expect(img.decoding).toBe("async")
      expect(img.referrerPolicy).toBe("strict-origin-when-cross-origin")
    } finally {
      globalThis.Image = origImage
    }
  })

  it("#33: wraps <img> in <picture> with <source> descriptors", async () => {
    // Use jsdom's real Image so ownerDocument / createElement works.
    const item: ImageItem = {
      type: "image",
      src: "https://example.com/a.jpg",
      alt: "A",
      sources: [
        { type: "image/avif", srcset: "a.avif 1x, a@2x.avif 2x", sizes: "100vw" },
        { type: "image/webp", srcset: "a.webp 1x" },
        { media: "(max-width: 600px)", srcset: "a-sm.jpg" },
      ],
    }
    // Stub Image minimally so load fires, but keep document-backed
    // ownerDocument (jsdom provides this on HTMLImageElement).
    const origImage = globalThis.Image
    globalThis.Image = class extends origImage {
      constructor() {
        super()
        queueMicrotask(() => this.dispatchEvent(new Event("load")))
        Object.defineProperty(this, "complete", { get: () => true })
        Object.defineProperty(this, "naturalWidth", { get: () => 1600 })
        Object.defineProperty(this, "naturalHeight", { get: () => 900 })
      }
    } as typeof Image
    try {
      const result = await loadImage(item, new AbortController().signal)
      expect(result.element.tagName.toLowerCase()).toBe("picture")
      expect(result.image.tagName.toLowerCase()).toBe("img")
      const sources = (result.element as HTMLPictureElement).querySelectorAll("source")
      expect(sources.length).toBe(3)
      expect(sources[0]!.type).toBe("image/avif")
      expect(sources[0]!.srcset).toBe("a.avif 1x, a@2x.avif 2x")
      expect(sources[0]!.sizes).toBe("100vw")
      expect(sources[1]!.type).toBe("image/webp")
      expect(sources[2]!.media).toBe("(max-width: 600px)")
      // The <img> must be the last child of <picture> so it acts as
      // the fallback when no <source> matches.
      const last = result.element.lastElementChild
      expect(last?.tagName.toLowerCase()).toBe("img")
    } finally {
      globalThis.Image = origImage
    }
  })

  it("#33: bare src (no sources) still returns the <img> directly", async () => {
    const origImage = globalThis.Image
    globalThis.Image = class extends origImage {
      constructor() {
        super()
        queueMicrotask(() => this.dispatchEvent(new Event("load")))
        Object.defineProperty(this, "complete", { get: () => true })
        Object.defineProperty(this, "naturalWidth", { get: () => 1 })
        Object.defineProperty(this, "naturalHeight", { get: () => 1 })
      }
    } as typeof Image
    try {
      const item: ImageItem = { type: "image", src: "https://example.com/a.jpg" }
      const result = await loadImage(item, new AbortController().signal)
      expect(result.element.tagName.toLowerCase()).toBe("img")
      expect(result.element).toBe(result.image)
    } finally {
      globalThis.Image = origImage
    }
  })

  it("aborts via AbortSignal", async () => {
    const origImage = globalThis.Image
    class StubImage {
      public src = ""
      public complete = false
      public naturalWidth = 0
      public naturalHeight = 0
      addEventListener(): void {}
      removeEventListener(): void {}
      setAttribute(): void {}
    }
    // @ts-expect-error — test stub
    globalThis.Image = StubImage
    try {
      const ctrl = new AbortController()
      const item: ImageItem = { type: "image", src: "https://example.com/a.jpg" }
      const p = loadImage(item, ctrl.signal)
      ctrl.abort()
      await expect(p).rejects.toThrow(/aborted/)
    } finally {
      globalThis.Image = origImage
    }
  })
})
