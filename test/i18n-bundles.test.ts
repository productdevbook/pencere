import { describe, expect, it } from "vitest"

import { getStrings, strings } from "../src/i18n-bundles"

describe("i18n bundles", () => {
  it("ships 14 locales", () => {
    expect(Object.keys(strings).length).toBe(14)
  })

  it("every locale has every key", () => {
    const keys = Object.keys(strings.en) as Array<keyof typeof strings.en>
    for (const [locale, bundle] of Object.entries(strings)) {
      for (const key of keys) {
        expect(bundle[key], `${locale}.${key}`).toBeTruthy()
      }
    }
  })

  it("getStrings() returns exact match", () => {
    expect(getStrings("tr").close).toBe("Kapat")
    expect(getStrings("de").close).toBe("Schließen")
  })

  it("getStrings() falls back to language prefix", () => {
    expect(getStrings("tr-TR").close).toBe("Kapat")
    expect(getStrings("de-AT").close).toBe("Schließen")
  })

  it("getStrings() falls back to English for unknown locales", () => {
    expect(getStrings("eo").close).toBe("Close")
    expect(getStrings("xx-YY").close).toBe("Close")
  })

  it("regional pt-BR resolves", () => {
    expect(getStrings("pt-BR").close).toBe("Fechar")
  })

  it("zh-CN and zh-TW are distinct entries", () => {
    expect(getStrings("zh-CN")).not.toBe(getStrings("zh-TW"))
  })
})
