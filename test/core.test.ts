import { describe, expect, it, vi } from "vitest";
import { Pencere, PencereIndexError, PencereStateError } from "../src/index";
import type { ImageItem } from "../src/index";

const items: ImageItem[] = [
  { type: "image", src: "a.jpg" },
  { type: "image", src: "b.jpg" },
  { type: "image", src: "c.jpg" },
];

describe("Pencere core", () => {
  it("constructs with items and default state", () => {
    const p = new Pencere({ items });
    expect(p.state.index).toBe(0);
    expect(p.state.isOpen).toBe(false);
    expect(p.state.items).toEqual(items);
  });

  it("rejects empty items", () => {
    expect(() => new Pencere({ items: [] })).toThrow(PencereIndexError);
  });

  it("rejects out-of-bounds startIndex", () => {
    expect(() => new Pencere({ items, startIndex: 3 })).toThrow(PencereIndexError);
  });

  it("opens and closes with events in order", async () => {
    const p = new Pencere({ items });
    const order: string[] = [];
    p.events.on("beforeOpen", () => order.push("beforeOpen"));
    p.events.on("open", () => order.push("open"));
    p.events.on("beforeClose", () => order.push("beforeClose"));
    p.events.on("close", () => order.push("close"));

    await p.open();
    expect(p.state.isOpen).toBe(true);
    await p.close();
    expect(p.state.isOpen).toBe(false);

    expect(order).toEqual(["beforeOpen", "open", "beforeClose", "close"]);
  });

  it("open(index) sets currentIndex", async () => {
    const p = new Pencere({ items });
    await p.open(2);
    expect(p.state.index).toBe(2);
    expect(p.item.src).toBe("c.jpg");
  });

  it("open() is idempotent while already open", async () => {
    const p = new Pencere({ items });
    const spy = vi.fn();
    p.events.on("open", spy);
    await p.open();
    await p.open();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("goTo() before open() throws", async () => {
    const p = new Pencere({ items });
    await expect(p.goTo(1)).rejects.toThrow(PencereStateError);
  });

  it("goTo() emits beforeChange then change", async () => {
    const p = new Pencere({ items });
    await p.open();
    const order: string[] = [];
    p.events.on("beforeChange", (e) => order.push(`beforeChange:${e.from}->${e.to}`));
    p.events.on("change", (e) => order.push(`change:${e.to}`));
    await p.goTo(2);
    expect(order).toEqual(["beforeChange:0->2", "change:2"]);
    expect(p.state.index).toBe(2);
  });

  it("goTo() to same index is a no-op", async () => {
    const p = new Pencere({ items });
    await p.open();
    const spy = vi.fn();
    p.events.on("change", spy);
    await p.goTo(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("next() loops by default", async () => {
    const p = new Pencere({ items });
    await p.open(2);
    await p.next();
    expect(p.state.index).toBe(0);
  });

  it("next() stops at end when loop=false", async () => {
    const p = new Pencere({ items, loop: false });
    await p.open(2);
    await p.next();
    expect(p.state.index).toBe(2);
  });

  it("prev() loops by default", async () => {
    const p = new Pencere({ items });
    await p.open(0);
    await p.prev();
    expect(p.state.index).toBe(2);
  });

  it("prev() stops at start when loop=false", async () => {
    const p = new Pencere({ items, loop: false });
    await p.open(0);
    await p.prev();
    expect(p.state.index).toBe(0);
  });

  it("setItems() clamps currentIndex", () => {
    const p = new Pencere({ items, startIndex: 2 });
    p.setItems([items[0]!]);
    expect(p.state.index).toBe(0);
  });

  it("setItems() rejects empty array", () => {
    const p = new Pencere({ items });
    expect(() => p.setItems([])).toThrow(PencereIndexError);
  });

  it("close reason is propagated", async () => {
    const p = new Pencere({ items });
    await p.open();
    let seen = "";
    p.events.on("close", (e) => {
      seen = e.reason;
    });
    await p.close("escape");
    expect(seen).toBe("escape");
  });

  it("destroy() clears listeners and emits destroy", async () => {
    const p = new Pencere({ items });
    const destroySpy = vi.fn();
    const changeSpy = vi.fn();
    p.events.on("destroy", destroySpy);
    p.events.on("change", changeSpy);
    p.destroy();
    expect(destroySpy).toHaveBeenCalledTimes(1);
    // After destroy the emitter is cleared
    p.events.emit("change", { from: 0, to: 1, item: items[1]! });
    expect(changeSpy).not.toHaveBeenCalled();
  });

  it("constructor copies items array (isolation)", () => {
    const local = [...items];
    const p = new Pencere({ items: local });
    local.pop();
    expect(p.state.items.length).toBe(3);
  });
});
