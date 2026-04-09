/**
 * Automated accessibility smoke test using axe-core.
 *
 * Runs axe against a mounted PencereViewer and fails on any violation
 * of tags "wcag2a", "wcag2aa", "wcag21aa", or "best-practice". This
 * is intentionally narrow — richer audits belong in a Playwright-based
 * browser test matrix.
 */
import axe from "axe-core"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { _resetScrollLock } from "../../src/dom/scroll-lock"
import { PencereViewer } from "../../src/dom/viewer"
import type { ImageItem } from "../../src/index"

const originalImage = globalThis.Image

class StubImage {
  public src = ""
  public srcset = ""
  public sizes = ""
  public alt = ""
  public width = 0
  public height = 0
  public complete = true
  public naturalWidth = 100
  public naturalHeight = 100
  public decoding = ""
  public crossOrigin: string | null = null
  public referrerPolicy = ""
  public style: { cssText: string; transform: string } = { cssText: "", transform: "" }
  addEventListener(_: string, fn: () => void): void {
    queueMicrotask(fn)
  }
  removeEventListener(): void {}
  setAttribute(): void {}
}

const items: ImageItem[] = [
  { type: "image", src: "https://example.com/a.jpg", alt: "alpha" },
  { type: "image", src: "https://example.com/b.jpg", alt: "beta" },
]

describe("axe-core smoke test", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    _resetScrollLock()
    // @ts-expect-error — test stub
    globalThis.Image = StubImage
  })
  afterEach(() => {
    globalThis.Image = originalImage
  })

  it("an opened PencereViewer has no serious axe violations", async () => {
    const v = new PencereViewer({
      items,
      lockScroll: false,
      useNativeDialog: false,
    })
    await v.open()
    // Let renderSlide complete.
    await new Promise((resolve) => setTimeout(resolve, 20))

    // axe-core's jsdom mode is limited but catches structural issues.
    const results = await axe.run(v.root, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      // jsdom does not render styles so color-contrast is unreliable.
      rules: {
        "color-contrast": { enabled: false },
      },
    })
    if (results.violations.length > 0) {
      // Emit a readable failure rather than a dump.
      const summary = results.violations.map((v) => `${v.id}: ${v.description}`).join("\n")
      throw new Error(`axe violations:\n${summary}`)
    }
    expect(results.violations.length).toBe(0)

    await v.close()
    v.destroy()
  })
})
