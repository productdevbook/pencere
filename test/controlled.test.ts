import { describe, expect, it, vi } from "vitest"

import { Pencere } from "../src/core"
import type { ImageItem } from "../src/types"

const items: ImageItem[] = [
  { type: "image", src: "https://example.com/1.jpg", alt: "one" },
  { type: "image", src: "https://example.com/2.jpg", alt: "two" },
  { type: "image", src: "https://example.com/3.jpg", alt: "three" },
]

describe("Pencere controlled mode (#6)", () => {
  it("open() emits requestOpen and does NOT mutate state", async () => {
    const p = new Pencere({ items, controlled: true })
    const spy = vi.fn()
    p.events.on("requestOpen", spy)
    p.events.on("open", () => {
      throw new Error("open should not fire in controlled mode")
    })
    await p.open(1)
    expect(spy).toHaveBeenCalledWith({ index: 1 })
    expect(p.state.isOpen).toBe(false)
  })

  it("commitOpen() advances state after the consumer approves", async () => {
    const p = new Pencere({ items, controlled: true })
    const openSpy = vi.fn()
    p.events.on("open", openSpy)
    p.events.on("requestOpen", ({ index }) => {
      p.commitOpen(index)
    })
    await p.open(2)
    expect(openSpy).toHaveBeenCalled()
    expect(p.state.isOpen).toBe(true)
    expect(p.state.index).toBe(2)
  })

  it("goTo() emits requestChange and only advances after commitChange", async () => {
    const p = new Pencere({ items, controlled: true })
    p.events.on("requestOpen", ({ index }) => p.commitOpen(index))
    await p.open(0)

    const reqSpy = vi.fn()
    const changeSpy = vi.fn()
    p.events.on("requestChange", reqSpy)
    p.events.on("change", changeSpy)

    await p.goTo(2)
    expect(reqSpy).toHaveBeenCalledWith({ from: 0, to: 2 })
    expect(changeSpy).not.toHaveBeenCalled()
    expect(p.state.index).toBe(0)

    p.commitChange(2)
    expect(changeSpy).toHaveBeenCalled()
    expect(p.state.index).toBe(2)
  })

  it("close() emits requestClose and only closes after commitClose", async () => {
    const p = new Pencere({ items, controlled: true })
    p.events.on("requestOpen", ({ index }) => p.commitOpen(index))
    await p.open(0)

    const reqSpy = vi.fn()
    p.events.on("requestClose", reqSpy)
    await p.close("escape")
    expect(reqSpy).toHaveBeenCalledWith({ reason: "escape" })
    expect(p.state.isOpen).toBe(true)

    p.commitClose("escape")
    expect(p.state.isOpen).toBe(false)
  })

  it("isControlled reflects the option", () => {
    expect(new Pencere({ items }).isControlled).toBe(false)
    expect(new Pencere({ items, controlled: true }).isControlled).toBe(true)
  })

  it("uncontrolled mode still mutates synchronously (no regression)", async () => {
    const p = new Pencere({ items })
    await p.open(1)
    expect(p.state.isOpen).toBe(true)
    expect(p.state.index).toBe(1)
    await p.goTo(2)
    expect(p.state.index).toBe(2)
    await p.close()
    expect(p.state.isOpen).toBe(false)
  })
})
