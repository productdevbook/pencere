import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Haptics } from "../../src/dom/haptics"

interface Navish {
  vibrate?: (p: number | number[]) => boolean
}

describe("Haptics", () => {
  let originalVibrate: Navish["vibrate"]
  let originalMatchMedia: typeof window.matchMedia | undefined

  beforeEach(() => {
    originalVibrate = (navigator as unknown as Navish).vibrate
    originalMatchMedia = window.matchMedia
    ;(navigator as unknown as Navish).vibrate = vi.fn(() => true)
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes("coarse"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      }) as unknown as MediaQueryList) as typeof window.matchMedia
  })

  afterEach(() => {
    if (originalVibrate === undefined) {
      delete (navigator as unknown as Navish).vibrate
    } else {
      ;(navigator as unknown as Navish).vibrate = originalVibrate
    }
    if (originalMatchMedia) window.matchMedia = originalMatchMedia
  })

  it("is a no-op when not explicitly enabled", () => {
    const h = new Haptics()
    h.fire("dismiss")
    expect((navigator as unknown as Navish).vibrate).not.toHaveBeenCalled()
  })

  it("fires default patterns for each event when enabled", () => {
    const h = new Haptics({ enabled: true })
    expect(h.available).toBe(true)
    h.fire("dismiss")
    h.fire("snap")
    h.fire("doubleTap")
    const vibrate = (navigator as unknown as Navish).vibrate as ReturnType<typeof vi.fn>
    expect(vibrate).toHaveBeenNthCalledWith(1, 12)
    expect(vibrate).toHaveBeenNthCalledWith(2, 8)
    expect(vibrate).toHaveBeenNthCalledWith(3, 6)
  })

  it("accepts custom pattern overrides", () => {
    const h = new Haptics({ enabled: true, patterns: { dismiss: [20, 30, 20] } })
    h.fire("dismiss")
    expect((navigator as unknown as Navish).vibrate).toHaveBeenCalledWith([20, 30, 20])
  })

  it("is unavailable on fine-pointer (desktop) even when enabled", () => {
    window.matchMedia = ((query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      }) as unknown as MediaQueryList) as typeof window.matchMedia
    const h = new Haptics({ enabled: true })
    expect(h.available).toBe(false)
    h.fire("dismiss")
    expect((navigator as unknown as Navish).vibrate).not.toHaveBeenCalled()
  })

  it("no-ops when navigator.vibrate is not exposed (iOS Safari)", () => {
    delete (navigator as unknown as Navish).vibrate
    const h = new Haptics({ enabled: true })
    expect(h.available).toBe(false)
    // This must not throw.
    h.fire("doubleTap")
  })

  it("swallows errors from vibrate() itself", () => {
    ;(navigator as unknown as Navish).vibrate = (() => {
      throw new Error("unsupported pattern")
    }) as Navish["vibrate"]
    const h = new Haptics({ enabled: true })
    expect(() => h.fire("snap")).not.toThrow()
  })
})
