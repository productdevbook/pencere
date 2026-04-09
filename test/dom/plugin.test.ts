import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { _resetScrollLock } from "../../src/dom/scroll-lock"
import type { ImageItem, Item, PencerePlugin } from "../../src/index"
import { PencereViewer, slideshowPlugin } from "../../src/index"

const originalImage = globalThis.Image

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

describe("PencerePlugin (#4)", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    _resetScrollLock()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // @ts-expect-error stub
    globalThis.Image = StubImage
  })
  afterEach(() => {
    vi.useRealTimers()
    globalThis.Image = originalImage
  })

  it("install receives a narrow context and runs before user hooks", async () => {
    const order: string[] = []
    const plugin: PencerePlugin<ImageItem> = {
      name: "order-test",
      install(ctx) {
        expect(typeof ctx.registerHook).toBe("function")
        expect(typeof ctx.registerRenderer).toBe("function")
        expect(ctx.dom.root).toBeInstanceOf(HTMLDialogElement)
        expect(ctx.core).toBeDefined()
        expect(ctx.events).toBeDefined()
        ctx.registerHook("willOpen", () => {
          order.push("plugin:willOpen")
        })
        ctx.registerHook("didOpen", () => {
          order.push("plugin:didOpen")
        })
        return () => {}
      },
    }
    const v = new PencereViewer<ImageItem>({
      items,
      lockScroll: false,
      useNativeDialog: false,
      plugins: [plugin],
      hooks: {
        willOpen: () => {
          order.push("user:willOpen")
        },
        didOpen: () => {
          order.push("user:didOpen")
        },
      },
    })
    await v.open(0)
    expect(order).toEqual(["plugin:willOpen", "user:willOpen", "plugin:didOpen", "user:didOpen"])
    await v.close()
    v.destroy()
  })

  it("plugin uninstall fires on destroy in reverse order", () => {
    const uninstalls: string[] = []
    const p = (name: string): PencerePlugin<ImageItem> => ({
      name,
      install: () => () => uninstalls.push(name),
    })
    const v = new PencereViewer<ImageItem>({
      items,
      lockScroll: false,
      useNativeDialog: false,
      plugins: [p("a"), p("b"), p("c")],
    })
    v.destroy()
    expect(uninstalls).toEqual(["c", "b", "a"])
  })

  it("install throw does not break the viewer", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const bad: PencerePlugin<ImageItem> = {
      name: "bad",
      install: () => {
        throw new Error("boom")
      },
    }
    const v = new PencereViewer<ImageItem>({
      items,
      lockScroll: false,
      useNativeDialog: false,
      plugins: [bad],
    })
    expect(warn).toHaveBeenCalled()
    v.destroy()
    warn.mockRestore()
  })

  it("slideshowPlugin auto-advances on a timer and stops on close", async () => {
    const v = new PencereViewer<ImageItem>({
      items,
      lockScroll: false,
      useNativeDialog: false,
      plugins: [slideshowPlugin({ intervalMs: 1000, pauseOnHover: false })],
    })
    await v.open(0)
    expect(v.core.state.index).toBe(0)
    await vi.advanceTimersByTimeAsync(1000)
    expect(v.core.state.index).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(v.core.state.index).toBe(2)
    await v.close()
    // After close, the timer must not fire again.
    const beforeIdx = v.core.state.index
    await vi.advanceTimersByTimeAsync(3000)
    expect(v.core.state.index).toBe(beforeIdx)
    v.destroy()
  })

  it("registerRenderer picks up user-supplied renderers for non-image items", async () => {
    const v = new PencereViewer({
      items: [{ type: "custom:demo", alt: "demo" } as unknown as ImageItem],
      lockScroll: false,
      useNativeDialog: false,
      plugins: [
        {
          name: "demo-renderer",
          install(ctx) {
            return ctx.registerRenderer({
              canHandle: (i): i is Item => i.type === "custom:demo",
              mount: (_, { document: doc }) => {
                const el = doc.createElement("p")
                el.textContent = "plugin renderer"
                el.setAttribute("data-plugin-renderer", "true")
                return el
              },
            })
          },
        },
      ],
    })
    await v.open(0)
    await new Promise((r) => setTimeout(r, 30))
    expect(v.root.querySelector("[data-plugin-renderer]")).toBeTruthy()
    await v.close()
    v.destroy()
  })
})
