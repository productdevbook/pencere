import { describe, expect, it } from "vitest"

import { escapeHtml, isSafeUrl, safeUrl } from "../src/security"

describe("safeUrl()", () => {
  it("accepts https URLs", () => {
    expect(safeUrl("https://example.com/a.jpg")).toBe("https://example.com/a.jpg")
  })

  it("accepts http URLs", () => {
    expect(safeUrl("http://example.com/a.jpg")).toBe("http://example.com/a.jpg")
  })

  it("accepts data: image URLs", () => {
    expect(safeUrl("data:image/png;base64,iVBORw0KGgo=")).toContain("data:image/png")
    expect(safeUrl("data:image/jpeg;base64,/9j/4AAQ")).toContain("data:image/jpeg")
    expect(safeUrl("data:image/svg+xml,<svg/>")).toContain("data:image/svg")
  })

  it("rejects data:text/html XSS payloads", () => {
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBeNull()
    expect(safeUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")).toBeNull()
    expect(safeUrl("data:application/javascript,alert(1)")).toBeNull()
    expect(safeUrl("data:text/plain,hello")).toBeNull()
  })

  it("accepts blob: URLs", () => {
    const href = safeUrl("blob:https://example.com/abc-123")
    expect(href).toContain("blob:")
  })

  it("accepts mailto:", () => {
    expect(safeUrl("mailto:a@b.c")).toBe("mailto:a@b.c")
  })

  it("rejects javascript: protocol", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull()
  })

  it("rejects JavaScript: with uppercase", () => {
    expect(safeUrl("JavaScript:alert(1)")).toBeNull()
  })

  it("rejects javascript: with embedded whitespace", () => {
    expect(safeUrl("java\tscript:alert(1)")).toBeNull()
    expect(safeUrl("java\nscript:alert(1)")).toBeNull()
    expect(safeUrl(" javascript:alert(1)")).toBeNull()
  })

  it("rejects vbscript: protocol", () => {
    expect(safeUrl("vbscript:msgbox(1)")).toBeNull()
  })

  it("rejects file: protocol", () => {
    expect(safeUrl("file:///etc/passwd")).toBeNull()
  })

  it("rejects empty input", () => {
    expect(safeUrl("")).toBeNull()
    expect(safeUrl("   ")).toBeNull()
  })

  it("rejects unparseable URLs", () => {
    expect(safeUrl("not a url at all :: ::")).toBeNull()
  })

  it("resolves relative URLs against a base", () => {
    expect(safeUrl("/a.jpg", "https://example.com")).toBe("https://example.com/a.jpg")
  })

  it("returns null for relative URL without base", () => {
    expect(safeUrl("/a.jpg")).toBeNull()
  })

  it("rejects non-string input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(safeUrl(null as unknown as string)).toBeNull()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(safeUrl(undefined as unknown as string)).toBeNull()
  })
})

describe("isSafeUrl()", () => {
  it("returns true for safe URLs", () => {
    expect(isSafeUrl("https://example.com")).toBe(true)
  })
  it("returns false for javascript:", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false)
  })
})

describe("escapeHtml()", () => {
  it("escapes ampersand first", () => {
    expect(escapeHtml("&")).toBe("&amp;")
  })

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;")
  })

  it("escapes quotes", () => {
    expect(escapeHtml(`"'`)).toBe("&quot;&#39;")
  })

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Merhaba dünya")).toBe("Merhaba dünya")
  })

  it("handles the full XSS payload", () => {
    expect(escapeHtml("<img src=x onerror=alert(1)>")).toBe("&lt;img src=x onerror=alert(1)&gt;")
  })
})
