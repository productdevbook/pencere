import { beforeEach, describe, expect, it } from "vitest"

import { firstTabbable, getTabbable, isTabbable, lastTabbable } from "../../src/dom"

function setup(html: string): HTMLElement {
  document.body.innerHTML = `<div id="root">${html}</div>`
  return document.getElementById("root")!
}

describe("getTabbable()", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("returns buttons, inputs, and links in document order", () => {
    const root = setup(`
      <button id="a">A</button>
      <a href="#" id="b">B</a>
      <input id="c" />
    `)
    const ids = getTabbable(root).map((el) => el.id)
    expect(ids).toEqual(["a", "b", "c"])
  })

  it("skips disabled form controls", () => {
    const root = setup(`
      <button id="a">A</button>
      <button id="b" disabled>B</button>
      <input id="c" disabled />
    `)
    const ids = getTabbable(root).map((el) => el.id)
    expect(ids).toEqual(["a"])
  })

  it("skips tabindex='-1'", () => {
    const root = setup(`
      <button id="a">A</button>
      <button id="b" tabindex="-1">B</button>
    `)
    expect(getTabbable(root).map((el) => el.id)).toEqual(["a"])
  })

  it("skips elements inside inert subtree", () => {
    const root = setup(`
      <button id="a">A</button>
      <div inert>
        <button id="b">B</button>
      </div>
    `)
    expect(getTabbable(root).map((el) => el.id)).toEqual(["a"])
  })

  it("includes tabindex='0' non-interactive elements", () => {
    const root = setup(`
      <div tabindex="0" id="a">A</div>
    `)
    expect(getTabbable(root).map((el) => el.id)).toEqual(["a"])
  })

  it("firstTabbable / lastTabbable return edges", () => {
    const root = setup(`
      <button id="a">A</button>
      <button id="b">B</button>
      <button id="c">C</button>
    `)
    expect(firstTabbable(root)?.id).toBe("a")
    expect(lastTabbable(root)?.id).toBe("c")
  })

  it("isTabbable reports false for hidden inputs", () => {
    const root = setup(`<input id="a" type="hidden" />`)
    const el = root.querySelector<HTMLElement>("#a")!
    expect(isTabbable(el)).toBe(false)
  })
})
