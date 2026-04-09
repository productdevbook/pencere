import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { bindPencere } from "../../src/dom/bind"

describe("bindPencere() (#7)", () => {
  let cleanup: (() => void) | null = null

  beforeEach(() => {
    document.body.innerHTML = ""
  })
  afterEach(() => {
    cleanup?.()
    cleanup = null
    document.body.innerHTML = ""
  })

  function link(
    href: string,
    opts: { group?: string; caption?: string; alt?: string } = {},
  ): HTMLAnchorElement {
    const a = document.createElement("a")
    a.href = href
    a.setAttribute("data-pencere", "")
    if (opts.group) a.setAttribute("data-gallery", opts.group)
    if (opts.caption) a.setAttribute("data-caption", opts.caption)
    if (opts.alt) a.setAttribute("data-alt", opts.alt)
    document.body.appendChild(a)
    return a
  }

  it("opens the viewer when a matching link is clicked", async () => {
    link("https://example.com/a.jpg", { alt: "A" })
    cleanup = bindPencere("[data-pencere]", { lockScroll: false, useNativeDialog: false })
    const a = document.querySelector("a") as HTMLAnchorElement
    a.click()
    await new Promise((r) => setTimeout(r, 10))
    const root = document.body.querySelector(".pc-root--open")
    expect(root).not.toBeNull()
  })

  it("groups links by data-gallery and opens at the clicked index", async () => {
    const a = link("https://example.com/a.jpg", { group: "g1", alt: "A" })
    link("https://example.com/b.jpg", { group: "g1", alt: "B" })
    link("https://example.com/c.jpg", { group: "g1", alt: "C" })
    cleanup = bindPencere("[data-pencere]", { lockScroll: false, useNativeDialog: false })
    const third = document.querySelectorAll("a")[2] as HTMLAnchorElement
    third.click()
    await new Promise((r) => setTimeout(r, 10))
    // The captured counter reflects image 3 of 3.
    const counter = document.querySelector(".pc-counter")
    expect(counter?.textContent).toMatch(/3 of 3/)
    // Clicking the first link should navigate to index 0 in the same viewer.
    a.click()
    await new Promise((r) => setTimeout(r, 10))
    expect(document.querySelector(".pc-counter")?.textContent).toMatch(/1 of 3/)
  })

  it("respects modifier keys so Cmd+Click still opens in a new tab", async () => {
    link("https://example.com/a.jpg", { alt: "A" })
    cleanup = bindPencere("[data-pencere]", { lockScroll: false, useNativeDialog: false })
    const a = document.querySelector("a") as HTMLAnchorElement
    // Dispatch a click that carries meta/ctrl so the bind handler ignores it.
    const evt = new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true })
    a.dispatchEvent(evt)
    expect(evt.defaultPrevented).toBe(false)
    // No viewer mounted.
    expect(document.querySelector(".pc-root--open")).toBeNull()
  })

  it("maps data attributes onto ImageItem fields", async () => {
    const a = link("https://example.com/a.jpg", { alt: "A", caption: "C" })
    a.setAttribute("data-longdesc", "long description")
    a.setAttribute("data-width", "1600")
    a.setAttribute("data-height", "1067")
    a.setAttribute("data-lang", "ja")
    cleanup = bindPencere("[data-pencere]", { lockScroll: false, useNativeDialog: false })
    a.click()
    await new Promise((r) => setTimeout(r, 10))
    const caption = document.querySelector(".pc-caption")
    expect(caption?.textContent).toBe("C")
    expect(caption?.getAttribute("lang")).toBe("ja")
  })

  it("unbind() removes the listener and destroys the viewer", async () => {
    link("https://example.com/a.jpg", { alt: "A" })
    const unbind = bindPencere("[data-pencere]", { lockScroll: false, useNativeDialog: false })
    const a = document.querySelector("a") as HTMLAnchorElement
    a.click()
    await new Promise((r) => setTimeout(r, 10))
    expect(document.querySelector(".pc-root--open")).not.toBeNull()
    unbind()
    // Root is gone.
    expect(document.querySelector("dialog.pc-root")).toBeNull()
    // Further clicks do nothing.
    a.click()
    await new Promise((r) => setTimeout(r, 10))
    expect(document.querySelector(".pc-root--open")).toBeNull()
  })
})
