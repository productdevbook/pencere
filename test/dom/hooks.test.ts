import { beforeEach, describe, expect, it, vi } from "vitest"

import { _resetScrollLock } from "../../src/dom/scroll-lock"
import type { ImageItem } from "../../src/index"
import { PencereViewer } from "../../src/index"

const items: ImageItem[] = [
  { type: "image", src: "https://example.com/1.jpg", alt: "one" },
  { type: "image", src: "https://example.com/2.jpg", alt: "two" },
  { type: "image", src: "https://example.com/3.jpg", alt: "three" },
]

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
  queueMicrotask(() => el.dispatchEvent(new Event("load")))
  return el
}

describe("PencereHooks (Phase 2)", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    _resetScrollLock()
    // @ts-expect-error — test stub
    globalThis.Image = StubImage
  })

  it("fires willOpen before didOpen with the right context", async () => {
    const order: string[] = []
    const v = new PencereViewer<ImageItem>({
      items,
      hooks: {
        willOpen: (ctx) => {
          order.push("willOpen")
          expect(ctx.index).toBe(1)
          expect(ctx.items.length).toBe(3)
        },
        didOpen: (ctx) => {
          order.push("didOpen")
          expect(ctx.index).toBe(1)
        },
      },
    })
    await v.open(1)
    expect(order).toEqual(["willOpen", "didOpen"])
    await v.close()
    v.destroy()
  })

  it("willOpen throwing aborts the open", async () => {
    const v = new PencereViewer<ImageItem>({
      items,
      hooks: {
        willOpen: () => {
          throw new Error("blocked")
        },
      },
    })
    await expect(v.open(0)).rejects.toThrow("blocked")
    expect(v.core.state.isOpen).toBe(false)
    v.destroy()
  })

  it("fires willClose / didClose with the reason", async () => {
    const reasons: string[] = []
    const v = new PencereViewer<ImageItem>({
      items,
      hooks: {
        willClose: (ctx) => {
          reasons.push(`will:${ctx.reason}`)
        },
        didClose: (ctx) => {
          reasons.push(`did:${ctx.reason}`)
        },
      },
    })
    await v.open(0)
    await v.close("escape")
    expect(reasons).toEqual(["will:escape", "did:escape"])
    v.destroy()
  })

  it("fires willRender / didRender on slide changes", async () => {
    const willR = vi.fn()
    const didR = vi.fn()
    const v = new PencereViewer<ImageItem>({
      items,
      hooks: { willRender: willR, didRender: didR },
    })
    await v.open(0)
    await new Promise((r) => setTimeout(r, 30))
    expect(willR).toHaveBeenCalled()
    expect(didR).toHaveBeenCalled()
    const beforeNext = willR.mock.calls.length
    await v.core.next()
    await new Promise((r) => setTimeout(r, 30))
    expect(willR.mock.calls.length).toBeGreaterThan(beforeNext)
    await v.close()
    v.destroy()
  })

  it("fires didNavigate with from / to", async () => {
    const calls: { from: number; to: number }[] = []
    const v = new PencereViewer<ImageItem>({
      items,
      hooks: {
        didNavigate: (ctx) => {
          calls.push({ from: ctx.from, to: ctx.to })
        },
      },
    })
    await v.open(0)
    await v.core.next()
    await v.core.next()
    expect(calls).toEqual([
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ])
    await v.close()
    v.destroy()
  })

  it("didClose throwing is swallowed with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const v = new PencereViewer<ImageItem>({
      items,
      hooks: {
        didClose: () => {
          throw new Error("boom")
        },
      },
    })
    await v.open(0)
    await expect(v.close()).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
    v.destroy()
  })
})
