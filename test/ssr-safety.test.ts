/**
 * SSR safety matrix (#74). These tests run under `environment: node`
 * (see vitest.config.ts), where there is no `window`, `document`,
 * `matchMedia`, or `ResizeObserver`. Importing any pencere surface
 * must succeed without a global DOM shim, and constructing the
 * pure `Pencere` core must work server-side.
 */

import { describe, expect, it } from "vitest"

describe("SSR safety", () => {
  it("imports the package index without touching window/document", async () => {
    // Guarantee there is no DOM-shaped global in this environment.
    expect(typeof (globalThis as { window?: unknown }).window).toBe("undefined")
    expect(typeof (globalThis as { document?: unknown }).document).toBe("undefined")
    const mod = await import("../src/index")
    expect(typeof mod.Pencere).toBe("function")
    expect(typeof mod.createPencere).toBe("function")
    // Named exports that do NOT need the DOM still resolve.
    expect(typeof mod.safeUrl).toBe("function")
    expect(typeof mod.escapeHtml).toBe("function")
    expect(typeof mod.createTrustedTypesPolicy).toBe("function")
  })

  it("constructs the core Pencere without a DOM", async () => {
    const { Pencere } = await import("../src/index")
    const p = new Pencere({
      items: [
        { type: "image", src: "https://example.com/a.jpg", alt: "A" },
        { type: "image", src: "https://example.com/b.jpg", alt: "B" },
      ],
    })
    expect(p.state.items.length).toBe(2)
    expect(p.state.isOpen).toBe(false)
  })

  it("imports the framework adapters without triggering DOM reads", async () => {
    // These modules would blow up at import time if they touched
    // `window` or `document` eagerly — the whole point of SSR
    // safety is that the import itself is a no-op until a mount
    // hook actually runs.
    const react = await import("../src/adapters/react")
    const vue = await import("../src/adapters/vue")
    const svelte = await import("../src/adapters/svelte")
    const solid = await import("../src/adapters/solid")
    expect(typeof react.useLightbox).toBe("function")
    expect(typeof vue.usePencere).toBe("function")
    expect(typeof svelte.pencere).toBe("function")
    expect(typeof solid.createPencereViewer).toBe("function")
  })

  it("safeUrl and escapeHtml are pure and SSR-friendly", async () => {
    const { safeUrl, escapeHtml } = await import("../src/security")
    expect(safeUrl("https://example.com/a.jpg")).toBe("https://example.com/a.jpg")
    expect(safeUrl("javascript:alert(1)")).toBe(null)
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;")
  })
})
