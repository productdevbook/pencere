import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { _resetStyleRegistry, injectStyles, PC_STYLES } from "../../src/dom/styles"

describe("injectStyles", () => {
  beforeEach(() => {
    _resetStyleRegistry()
    document.head.innerHTML = ""
    document.body.innerHTML = ""
  })
  afterEach(() => {
    _resetStyleRegistry()
  })

  it("attaches the stylesheet exactly once per document", () => {
    injectStyles(document)
    injectStyles(document)
    injectStyles(document)
    // Either via adoptedStyleSheets (no <style>) or a single fallback.
    const fallbacks = document.querySelectorAll("style[data-pencere]")
    const adopted = (document as unknown as { adoptedStyleSheets?: CSSStyleSheet[] })
      .adoptedStyleSheets
    // jsdom supports adoptedStyleSheets starting at v22. Either path is
    // valid — the key invariant is that repeated calls never double up.
    expect(fallbacks.length + (adopted?.length ?? 0)).toBeLessThanOrEqual(1)
    // And the CSS text is either in adopted sheets or the <style>.
    if (fallbacks.length === 1) {
      expect(fallbacks[0]!.textContent).toBe(PC_STYLES)
    }
  })

  it("propagates the CSP nonce onto the fallback <style>", () => {
    // Force the <style> path: inject into a detached ShadowRoot wrapper
    // whose `adoptedStyleSheets` slot we strip so the capability probe
    // bails out to the <style> fallback.
    const host = document.createElement("div")
    document.body.appendChild(host)
    const originalReplaceSync = (CSSStyleSheet.prototype as { replaceSync?: unknown }).replaceSync
    try {
      // Wipe replaceSync so `hostSupportsAdopted` is false and fallback runs.
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (CSSStyleSheet.prototype as { replaceSync?: unknown }).replaceSync
      _resetStyleRegistry()
      injectStyles(document, "abc123")
      const style = document.querySelector("style[data-pencere]") as HTMLStyleElement
      expect(style).not.toBeNull()
      expect(style.getAttribute("nonce")).toBe("abc123")
    } finally {
      if (originalReplaceSync) {
        ;(CSSStyleSheet.prototype as { replaceSync?: unknown }).replaceSync = originalReplaceSync
      }
    }
  })

  it("does not set nonce when the caller does not pass one", () => {
    const originalReplaceSync = (CSSStyleSheet.prototype as { replaceSync?: unknown }).replaceSync
    try {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (CSSStyleSheet.prototype as { replaceSync?: unknown }).replaceSync
      _resetStyleRegistry()
      injectStyles(document)
      const style = document.querySelector("style[data-pencere]") as HTMLStyleElement
      expect(style?.hasAttribute("nonce")).toBe(false)
    } finally {
      if (originalReplaceSync) {
        ;(CSSStyleSheet.prototype as { replaceSync?: unknown }).replaceSync = originalReplaceSync
      }
    }
  })

  it("ships the key CSS hooks the viewer relies on", () => {
    // Regression guard: if any of these classes disappears the viewer
    // silently loses its layout.
    for (const sel of [
      ".pc-root",
      ".pc-stage",
      ".pc-slot",
      ".pc-img",
      ".pc-toolbar-top",
      ".pc-toolbar-bottom",
      ".pc-caption",
      ".pc-counter",
      ".pc-btn",
      ".pc-btn--nav",
      ".pc-btn--prev",
      ".pc-btn--next",
      ".pc-btn--close",
      ".pc-live",
    ]) {
      expect(PC_STYLES).toContain(sel)
    }
  })

  it("keeps the lightbox hidden until the --open class is applied", () => {
    expect(PC_STYLES).toMatch(/\.pc-root\s*\{[^}]*display:\s*none/)
    expect(PC_STYLES).toMatch(/pc-root--open[\s,\S]*display:\s*flex/)
  })

  it("exposes runtime values as CSS custom properties", () => {
    // The viewer should only ever touch --pc-* variables at runtime.
    expect(PC_STYLES).toContain("--pc-img-transform")
    expect(PC_STYLES).toContain("--pc-root-opacity")
    expect(PC_STYLES).toContain("--pc-slot-ar")
  })
})
