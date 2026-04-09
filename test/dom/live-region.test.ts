import { beforeEach, describe, expect, it } from "vitest"

import { LiveRegion } from "../../src/dom/live-region"

describe("LiveRegion", () => {
  let owner: HTMLElement
  beforeEach(() => {
    document.body.innerHTML = ""
    owner = document.createElement("div")
    document.body.appendChild(owner)
  })

  it("attaches a visually-hidden aria-live=polite node", () => {
    const lr = new LiveRegion(owner)
    const el = lr.element
    expect(el.getAttribute("aria-live")).toBe("polite")
    expect(el.getAttribute("aria-atomic")).toBe("true")
    expect(owner.contains(el)).toBe(true)
    lr.destroy()
  })

  it("debounces announcements and flush() applies synchronously", () => {
    const lr = new LiveRegion(owner, 1000)
    lr.announce("first")
    lr.announce("second")
    expect(lr.element.textContent).toBe("")
    lr.flush()
    expect(lr.element.textContent).toBe("second")
    lr.destroy()
  })

  it("destroy() removes the node", () => {
    const lr = new LiveRegion(owner)
    const el = lr.element
    lr.destroy()
    expect(owner.contains(el)).toBe(false)
  })

  it("uses textContent (never innerHTML) so captions cannot inject HTML", () => {
    const lr = new LiveRegion(owner, 0)
    lr.announce("<img src=x onerror=alert(1)>")
    lr.flush()
    expect(lr.element.innerHTML).toBe("&lt;img src=x onerror=alert(1)&gt;")
    lr.destroy()
  })
})
