import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { _resetScrollLock, lockScroll, unlockScroll } from "../../src/dom/scroll-lock"

describe("scroll-lock", () => {
  beforeEach(() => {
    document.body.innerHTML = "<div style='height:2000px'>content</div>"
    _resetScrollLock()
  })
  afterEach(() => {
    _resetScrollLock()
    document.body.removeAttribute("style")
    document.documentElement.removeAttribute("style")
  })

  it("lockScroll sets body overflow:hidden", () => {
    lockScroll()
    expect(document.body.style.overflow).toBe("hidden")
    expect(document.body.style.position).toBe("fixed")
  })

  it("unlockScroll restores previous styles", () => {
    document.body.style.overflow = "auto"
    lockScroll()
    unlockScroll()
    expect(document.body.style.overflow).toBe("auto")
    expect(document.body.style.position).toBe("")
  })

  it("nested lock/unlock only applies once", () => {
    lockScroll()
    lockScroll()
    unlockScroll()
    // Still locked after first unlock
    expect(document.body.style.position).toBe("fixed")
    unlockScroll()
    expect(document.body.style.position).toBe("")
  })

  it("unlockScroll() without prior lock is a no-op", () => {
    expect(() => unlockScroll()).not.toThrow()
  })
})
