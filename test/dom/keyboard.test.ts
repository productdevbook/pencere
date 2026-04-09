import { describe, expect, it } from "vitest"

import { resolveKeyAction } from "../../src/dom"

function key(init: KeyboardEventInit & { key: string; target?: Element }): KeyboardEvent {
  const e = new KeyboardEvent("keydown", init)
  if (init.target) Object.defineProperty(e, "target", { value: init.target })
  return e
}

describe("resolveKeyAction()", () => {
  it("maps Escape to close", () => {
    expect(resolveKeyAction(key({ key: "Escape" }))).toBe("close")
  })

  it("maps ArrowRight / PageDown to next", () => {
    expect(resolveKeyAction(key({ key: "ArrowRight" }))).toBe("next")
    expect(resolveKeyAction(key({ key: "PageDown" }))).toBe("next")
  })

  it("maps ArrowLeft / PageUp to prev", () => {
    expect(resolveKeyAction(key({ key: "ArrowLeft" }))).toBe("prev")
    expect(resolveKeyAction(key({ key: "PageUp" }))).toBe("prev")
  })

  it("maps Home / End to first / last", () => {
    expect(resolveKeyAction(key({ key: "Home" }))).toBe("first")
    expect(resolveKeyAction(key({ key: "End" }))).toBe("last")
  })

  it("maps +/-/0 to zoom actions", () => {
    expect(resolveKeyAction(key({ key: "+" }))).toBe("zoomIn")
    expect(resolveKeyAction(key({ key: "=" }))).toBe("zoomIn")
    expect(resolveKeyAction(key({ key: "-" }))).toBe("zoomOut")
    expect(resolveKeyAction(key({ key: "0" }))).toBe("zoomReset")
  })

  it("ignores events during IME composition (isComposing)", () => {
    expect(resolveKeyAction(key({ key: "Escape", isComposing: true }))).toBeNull()
  })

  it("ignores legacy IME keyCode 229", () => {
    const e = key({ key: "Enter" })
    Object.defineProperty(e, "keyCode", { value: 229 })
    expect(resolveKeyAction(e)).toBeNull()
  })

  it("ignores events with modifier keys", () => {
    expect(resolveKeyAction(key({ key: "ArrowRight", ctrlKey: true }))).toBeNull()
    expect(resolveKeyAction(key({ key: "ArrowRight", metaKey: true }))).toBeNull()
    expect(resolveKeyAction(key({ key: "ArrowRight", altKey: true }))).toBeNull()
  })

  it("ignores events when focus is inside an input", () => {
    const input = document.createElement("input")
    document.body.appendChild(input)
    expect(resolveKeyAction(key({ key: "Escape", target: input }))).toBeNull()
  })

  it("ignores events in textarea and contenteditable", () => {
    const ta = document.createElement("textarea")
    const div = document.createElement("div")
    div.setAttribute("contenteditable", "true")
    document.body.append(ta, div)
    expect(resolveKeyAction(key({ key: "Escape", target: ta }))).toBeNull()
    expect(resolveKeyAction(key({ key: "Escape", target: div }))).toBeNull()
  })

  it("respects disable option", () => {
    expect(resolveKeyAction(key({ key: "Escape" }), { disable: ["close"] })).toBeNull()
  })

  it("respects overrides option", () => {
    expect(resolveKeyAction(key({ key: "q" }), { overrides: { close: ["q"] } })).toBe("close")
  })
})
