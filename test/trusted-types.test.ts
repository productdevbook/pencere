import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { _resetTrustedTypesPolicy, createTrustedTypesPolicy } from "../src/security"

interface FakeTT {
  createPolicy: ReturnType<typeof vi.fn>
}

describe("createTrustedTypesPolicy()", () => {
  beforeEach(() => {
    _resetTrustedTypesPolicy()
  })
  afterEach(() => {
    _resetTrustedTypesPolicy()
    delete (globalThis as { trustedTypes?: unknown }).trustedTypes
  })

  it("returns a shim when Trusted Types is not available", () => {
    const policy = createTrustedTypesPolicy({ sanitize: (s) => `!${s}!` })
    expect(policy.createHTML("x")).toBe("!x!")
  })

  it("passes user html through the supplied sanitizer", () => {
    const sanitize = vi.fn((s: string) => s.replace(/<script.*?<\/script>/g, ""))
    const policy = createTrustedTypesPolicy({ sanitize })
    const out = policy.createHTML("<b>ok</b><script>bad()</script>")
    expect(sanitize).toHaveBeenCalledTimes(1)
    expect(out).toBe("<b>ok</b>")
  })

  it("routes through window.trustedTypes.createPolicy when available", () => {
    const tokens: string[] = []
    const fake: FakeTT = {
      createPolicy: vi.fn((name, rules: { createHTML?: (s: string) => string }) => {
        tokens.push(name)
        return {
          createHTML: (s: string): string => `TT(${rules.createHTML?.(s) ?? s})`,
        }
      }),
    }
    // @ts-expect-error polyfill under test
    globalThis.trustedTypes = fake
    const policy = createTrustedTypesPolicy({ sanitize: (s) => s.toUpperCase() })
    expect(fake.createPolicy).toHaveBeenCalledTimes(1)
    expect(tokens).toEqual(["pencere"])
    expect(policy.createHTML("hi")).toBe("TT(HI)")
  })

  it("memoizes the policy across repeat calls", () => {
    const fake: FakeTT = {
      createPolicy: vi.fn(() => ({ createHTML: (s: string): string => s })),
    }
    // @ts-expect-error polyfill
    globalThis.trustedTypes = fake
    const a = createTrustedTypesPolicy()
    const b = createTrustedTypesPolicy()
    expect(a).toBe(b)
    // Browser-side createPolicy must be called exactly once.
    expect(fake.createPolicy).toHaveBeenCalledTimes(1)
  })

  it("falls back to the shim when createPolicy throws (duplicate name)", () => {
    const fake: FakeTT = {
      createPolicy: vi.fn(() => {
        throw new Error("Policy 'pencere' already exists")
      }),
    }
    // @ts-expect-error polyfill
    globalThis.trustedTypes = fake
    const policy = createTrustedTypesPolicy({ sanitize: (s) => `clean:${s}` })
    expect(policy.createHTML("x")).toBe("clean:x")
  })

  it("honors a custom policy name", () => {
    const names: string[] = []
    const fake: FakeTT = {
      createPolicy: vi.fn((name) => {
        names.push(name)
        return { createHTML: (s: string): string => s }
      }),
    }
    // @ts-expect-error polyfill
    globalThis.trustedTypes = fake
    createTrustedTypesPolicy({ name: "gallery-html" })
    expect(names).toEqual(["gallery-html"])
  })
})
