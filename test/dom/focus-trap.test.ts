import { beforeEach, describe, expect, it } from "vitest";
import { FocusTrap } from "../../src/dom";

function setup(): {
  root: HTMLElement;
  outside: HTMLButtonElement;
  a: HTMLButtonElement;
  b: HTMLButtonElement;
  c: HTMLButtonElement;
} {
  document.body.innerHTML = `
    <button id="outside">outside</button>
    <div id="root">
      <button id="a">A</button>
      <button id="b">B</button>
      <button id="c">C</button>
    </div>
  `;
  return {
    root: document.getElementById("root") as HTMLElement,
    outside: document.getElementById("outside") as HTMLButtonElement,
    a: document.getElementById("a") as HTMLButtonElement,
    b: document.getElementById("b") as HTMLButtonElement,
    c: document.getElementById("c") as HTMLButtonElement,
  };
}

function tab(shift = false): KeyboardEvent {
  const e = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey: shift,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(e);
  return e;
}

describe("FocusTrap", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("moves focus to the first tabbable on activate()", () => {
    const { root, a } = setup();
    const trap = new FocusTrap(root);
    trap.activate();
    expect(document.activeElement).toBe(a);
    trap.deactivate();
  });

  it("respects initialFocus option", () => {
    const { root, b } = setup();
    const trap = new FocusTrap(root, { initialFocus: b });
    trap.activate();
    expect(document.activeElement).toBe(b);
    trap.deactivate();
  });

  it("wraps Tab from last to first", () => {
    const { root, a, c } = setup();
    const trap = new FocusTrap(root);
    trap.activate();
    c.focus();
    const e = tab(false);
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(a);
    trap.deactivate();
  });

  it("wraps Shift+Tab from first to last", () => {
    const { root, a, c } = setup();
    const trap = new FocusTrap(root);
    trap.activate();
    a.focus();
    const e = tab(true);
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(c);
    trap.deactivate();
  });

  it("restores focus to the previously focused element on deactivate()", () => {
    const { root, outside } = setup();
    outside.focus();
    const trap = new FocusTrap(root);
    trap.activate();
    expect(document.activeElement).not.toBe(outside);
    trap.deactivate();
    expect(document.activeElement).toBe(outside);
  });

  it("deactivate() with returnFocus:false does not restore", () => {
    const { root, outside } = setup();
    outside.focus();
    const trap = new FocusTrap(root, { returnFocus: false });
    trap.activate();
    trap.deactivate();
    expect(document.activeElement).not.toBe(outside);
  });

  it("isActive reflects trap state", () => {
    const { root } = setup();
    const trap = new FocusTrap(root);
    expect(trap.isActive).toBe(false);
    trap.activate();
    expect(trap.isActive).toBe(true);
    trap.deactivate();
    expect(trap.isActive).toBe(false);
  });
});
