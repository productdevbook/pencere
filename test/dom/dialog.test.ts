import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DialogController } from "../../src/dom"
import { _resetScrollLock } from "../../src/dom/scroll-lock"

function setup(kind: "div" | "dialog"): {
  root: HTMLElement
  sibling: HTMLElement
  insideButton: HTMLButtonElement
} {
  document.body.innerHTML = ""
  const sibling = document.createElement("main")
  sibling.id = "sibling"
  sibling.innerHTML = `<button id="s">s</button>`
  const root = document.createElement(kind)
  root.id = "root"
  const btn = document.createElement("button")
  btn.id = "inside"
  btn.textContent = "inside"
  root.appendChild(btn)
  document.body.append(sibling, root)
  return { root, sibling, insideButton: btn }
}

describe("DialogController", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    _resetScrollLock()
  })
  afterEach(() => {
    _resetScrollLock()
  })

  it("applies aria-modal + role on a plain div root", () => {
    const { root } = setup("div")
    new DialogController(root, { label: "Gallery" })
    expect(root.getAttribute("role")).toBe("dialog")
    expect(root.getAttribute("aria-modal")).toBe("true")
    expect(root.getAttribute("aria-label")).toBe("Gallery")
  })

  it("does not add role=dialog to a native <dialog>", () => {
    const { root } = setup("dialog")
    new DialogController(root)
    expect(root.getAttribute("role")).toBeNull()
    expect(root.getAttribute("aria-modal")).toBe("true")
  })

  it("show() focuses into the root and hide() restores focus", () => {
    const { root, insideButton } = setup("div")
    const trigger = document.createElement("button")
    document.body.appendChild(trigger)
    trigger.focus()
    const ctl = new DialogController(root, { lockScroll: false })
    ctl.show()
    expect(document.activeElement).toBe(insideButton)
    ctl.hide()
    expect(document.activeElement).toBe(trigger)
  })

  it("show() marks sibling elements inert; hide() releases them", () => {
    const { root, sibling } = setup("div")
    const ctl = new DialogController(root, { lockScroll: false })
    ctl.show()
    expect(sibling.hasAttribute("inert")).toBe(true)
    ctl.hide()
    expect(sibling.hasAttribute("inert")).toBe(false)
  })

  it("walks ancestors and inerts siblings at every level (#13)", () => {
    document.body.innerHTML = ""
    // Structure:
    //   <body>
    //     <main id=m>          ← ancestor of root, stays interactive
    //       <aside id=a>       ← sibling of root's parent, becomes inert
    //       <section id=s>     ← root's parent
    //         <nav id=n>       ← sibling of root, becomes inert
    //         <div id=root/>   ← the dialog
    //     <header id=h>        ← sibling of ancestor, becomes inert
    const h = document.createElement("header")
    h.id = "h"
    const m = document.createElement("main")
    const a = document.createElement("aside")
    const s = document.createElement("section")
    const n = document.createElement("nav")
    const root = document.createElement("div")
    s.append(n, root)
    m.append(a, s)
    document.body.append(h, m)

    const ctl = new DialogController(root, { lockScroll: false })
    ctl.show()
    expect(n.hasAttribute("inert")).toBe(true)
    expect(a.hasAttribute("inert")).toBe(true)
    expect(h.hasAttribute("inert")).toBe(true)
    // Ancestors of the dialog MUST remain interactive so focus can
    // reach the root itself.
    expect(m.hasAttribute("inert")).toBe(false)
    expect(s.hasAttribute("inert")).toBe(false)
    ctl.hide()
    expect(n.hasAttribute("inert")).toBe(false)
    expect(a.hasAttribute("inert")).toBe(false)
    expect(h.hasAttribute("inert")).toBe(false)
  })

  it("preserves pre-existing inert state across show/hide cycles", () => {
    const { root, sibling } = setup("div")
    sibling.setAttribute("inert", "")
    const ctl = new DialogController(root, { lockScroll: false })
    ctl.show()
    expect(sibling.hasAttribute("inert")).toBe(true)
    ctl.hide()
    // The consumer's own `inert` must survive — the dialog should
    // only remove the attributes it added.
    expect(sibling.hasAttribute("inert")).toBe(true)
  })

  it("ESC dispatches onDismiss('escape') on div-based dialog", () => {
    const { root } = setup("div")
    const onDismiss = vi.fn()
    const ctl = new DialogController(root, { lockScroll: false, onDismiss })
    ctl.show()
    const e = new KeyboardEvent("keydown", { key: "Escape", cancelable: true, bubbles: true })
    document.dispatchEvent(e)
    expect(onDismiss).toHaveBeenCalledWith("escape")
    ctl.hide()
  })

  it("double show() is a no-op", () => {
    const { root } = setup("div")
    const ctl = new DialogController(root, { lockScroll: false })
    ctl.show()
    ctl.show()
    expect(ctl.isOpen).toBe(true)
    ctl.hide()
  })

  it("hide() when not open is a no-op", () => {
    const { root } = setup("div")
    const ctl = new DialogController(root, { lockScroll: false })
    expect(() => ctl.hide()).not.toThrow()
  })

  it("uses CloseWatcher when available and routes cancel to onDismiss", () => {
    const { root } = setup("div")
    const destroyed: number[] = []
    class FakeCloseWatcher {
      oncancel: ((e: Event) => void) | null = null
      onclose: ((e: Event) => void) | null = null
      static instances: FakeCloseWatcher[] = []
      constructor() {
        FakeCloseWatcher.instances.push(this)
      }
      requestClose(): void {
        this.oncancel?.(new Event("cancel", { cancelable: true }))
      }
      destroy(): void {
        destroyed.push(1)
      }
    }
    // @ts-expect-error install polyfill for test
    globalThis.CloseWatcher = FakeCloseWatcher
    try {
      const onDismiss = vi.fn()
      const ctl = new DialogController(root, { lockScroll: false, onDismiss })
      ctl.show()
      expect(FakeCloseWatcher.instances.length).toBe(1)
      FakeCloseWatcher.instances[0]!.requestClose()
      expect(onDismiss).toHaveBeenCalledWith("escape")
      ctl.hide()
      expect(destroyed.length).toBe(1)
    } finally {
      // @ts-expect-error cleanup
      delete globalThis.CloseWatcher
    }
  })

  it("destroy() closes and strips role/aria-modal", () => {
    const { root } = setup("div")
    const ctl = new DialogController(root, { lockScroll: false })
    ctl.show()
    ctl.destroy()
    expect(ctl.isOpen).toBe(false)
    expect(root.getAttribute("role")).toBeNull()
    expect(root.getAttribute("aria-modal")).toBeNull()
  })
})
