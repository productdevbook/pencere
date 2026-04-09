import { describe, expect, it, vi } from "vitest"

import {
  BUILT_IN_RENDERERS,
  htmlRenderer,
  iframeRenderer,
  pickRenderer,
  videoRenderer,
} from "../../src/dom/renderers"
import type { Renderer } from "../../src/dom/renderers"
import { PencereViewer } from "../../src/dom/viewer"
import type { Item } from "../../src/types"

const signal = new AbortController().signal
const ctx = { document, signal }

describe("renderer registry (#8)", () => {
  it("built-ins cover video / iframe / html", () => {
    expect(BUILT_IN_RENDERERS).toHaveLength(3)
    expect(videoRenderer.canHandle({ type: "video", src: "x" })).toBe(true)
    expect(iframeRenderer.canHandle({ type: "iframe", src: "x" })).toBe(true)
    expect(htmlRenderer.canHandle({ type: "html", html: "x" })).toBe(true)
  })

  it("pickRenderer honors user list first, then built-ins", () => {
    const custom: Renderer = {
      canHandle(item: Item): item is Extract<Item, { type: "iframe" }> {
        return item.type === "iframe"
      },
      mount: () => document.createElement("div"),
    }
    const picked = pickRenderer({ type: "iframe", src: "x" }, [custom])
    expect(picked).toBe(custom)
  })

  it("pickRenderer returns null when no match", () => {
    const picked = pickRenderer({ type: "custom:foo", data: {} } as Item)
    expect(picked).toBeNull()
  })

  it("iframeRenderer applies a sandbox by default", () => {
    const el = iframeRenderer.mount(
      { type: "iframe", src: "https://example.com/embed" },
      ctx,
    ) as HTMLIFrameElement
    expect(el.tagName).toBe("IFRAME")
    expect(el.getAttribute("sandbox")).toContain("allow-scripts")
    expect(el.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin")
  })

  it("videoRenderer pauses and releases src on unmount", async () => {
    const el = videoRenderer.mount(
      { type: "video", src: "https://example.com/v.mp4", autoplay: true },
      ctx,
    ) as HTMLVideoElement
    expect(el.autoplay).toBe(true)
    expect(el.muted).toBe(true)
    const pause = vi.fn()
    ;(el as unknown as { pause: () => void }).pause = pause
    videoRenderer.unmount?.(el, { type: "video", src: "x" })
    expect(pause).toHaveBeenCalledTimes(1)
    expect(el.getAttribute("src")).toBeNull()
  })

  it("htmlRenderer accepts a string and a factory", () => {
    const str = htmlRenderer.mount({ type: "html", html: "<b>hi</b>" }, ctx)
    // Security: textContent, not innerHTML.
    expect((str as HTMLElement).textContent).toBe("<b>hi</b>")
    const factory = htmlRenderer.mount(
      {
        type: "html",
        html: () => {
          const el = document.createElement("section")
          el.setAttribute("data-test", "yes")
          return el
        },
      },
      ctx,
    )
    expect((factory as HTMLElement).getAttribute("data-test")).toBe("yes")
  })
})

describe("PencereViewer renderer integration (#8)", () => {
  it("mounts an iframe slide through the built-in renderer", async () => {
    const v = new PencereViewer({
      items: [{ type: "iframe", src: "https://example.com/embed", alt: "demo" }],
      lockScroll: false,
      useNativeDialog: false,
    })
    await v.open()
    await new Promise((r) => setTimeout(r, 10))
    const frame = v.root.querySelector("iframe")
    expect(frame).not.toBeNull()
    expect(frame?.getAttribute("src")).toBe("https://example.com/embed")
    await v.close()
    v.destroy()
  })

  it("user renderer wins over a built-in", async () => {
    const seen: string[] = []
    const custom: Renderer = {
      canHandle(item: Item): item is Extract<Item, { type: "iframe" }> {
        return item.type === "iframe"
      },
      mount(_item, c) {
        const el = c.document.createElement("div")
        el.setAttribute("data-renderer", "user")
        seen.push("user")
        return el
      },
    }
    const v = new PencereViewer({
      items: [{ type: "iframe", src: "https://example.com/embed" }],
      lockScroll: false,
      useNativeDialog: false,
      renderers: [custom],
    })
    await v.open()
    await new Promise((r) => setTimeout(r, 10))
    const marker = v.root.querySelector("[data-renderer='user']")
    expect(marker).not.toBeNull()
    expect(seen).toEqual(["user"])
    await v.close()
    v.destroy()
  })

  it("unmount() fires on the previous renderer before the next slide mounts", async () => {
    const unmount = vi.fn()
    const custom: Renderer = {
      canHandle(item: Item): item is Extract<Item, { type: "iframe" }> {
        return item.type === "iframe"
      },
      mount(_item, c) {
        return c.document.createElement("section")
      },
      unmount,
    }
    const v = new PencereViewer({
      items: [
        { type: "iframe", src: "https://example.com/a" },
        { type: "iframe", src: "https://example.com/b" },
      ],
      lockScroll: false,
      useNativeDialog: false,
      renderers: [custom],
    })
    await v.open()
    await new Promise((r) => setTimeout(r, 10))
    await v.core.next()
    await new Promise((r) => setTimeout(r, 10))
    expect(unmount).toHaveBeenCalledTimes(1)
    await v.close()
    v.destroy()
  })
})
