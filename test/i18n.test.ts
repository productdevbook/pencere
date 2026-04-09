import { describe, expect, it } from "vitest"

import { createTranslator, DEFAULT_STRINGS } from "../src/i18n"

describe("createTranslator()", () => {
  it("returns default English strings", () => {
    const t = createTranslator()
    expect(t("close")).toBe(DEFAULT_STRINGS.close)
    expect(t("next")).toBe("Next image")
  })

  it("applies overrides", () => {
    const t = createTranslator({ close: "Kapat", next: "Sonraki" })
    expect(t("close")).toBe("Kapat")
    expect(t("next")).toBe("Sonraki")
    // Untouched keys still fall through.
    expect(t("previous")).toBe(DEFAULT_STRINGS.previous)
  })

  it("interpolates {index} and {total}", () => {
    const t = createTranslator()
    expect(t("counter", { index: 3, total: 10 })).toBe("Image 3 of 10")
  })

  it("leaves unknown placeholders untouched", () => {
    const t = createTranslator({ counter: "{index}/{total} — {extra}" })
    expect(t("counter", { index: 1, total: 2 })).toBe("1/2 — {extra}")
  })
})
