import { describe, expect, it } from "vitest";
import { createPencere, PencereIndexError } from "../src/index";

const items = [
  { src: "a.jpg", alt: "A" },
  { src: "b.jpg", alt: "B" },
  { src: "c.jpg", alt: "C" },
];

describe("createPencere", () => {
  it("starts at index 0 by default", () => {
    const p = createPencere({ items });
    expect(p.index).toBe(0);
    expect(p.item.src).toBe("a.jpg");
    expect(p.length).toBe(3);
  });

  it("respects startIndex", () => {
    const p = createPencere({ items, startIndex: 2 });
    expect(p.index).toBe(2);
    expect(p.item.alt).toBe("C");
  });

  it("next() wraps around", async () => {
    const p = createPencere({ items, startIndex: 2 });
    const it = await p.next();
    expect(it.src).toBe("a.jpg");
    expect(p.index).toBe(0);
  });

  it("prev() wraps around", async () => {
    const p = createPencere({ items });
    const it = await p.prev();
    expect(it.src).toBe("c.jpg");
    expect(p.index).toBe(2);
  });

  it("goTo() jumps to a specific index", async () => {
    const p = createPencere({ items });
    const it = await p.goTo(1);
    expect(it.alt).toBe("B");
    expect(p.index).toBe(1);
  });

  it("throws on empty items", () => {
    expect(() => createPencere({ items: [] })).toThrow(PencereIndexError);
  });

  it("throws on out-of-bounds startIndex", () => {
    expect(() => createPencere({ items, startIndex: 5 })).toThrow(PencereIndexError);
  });

  it("throws on out-of-bounds goTo", async () => {
    const p = createPencere({ items });
    await expect(p.goTo(99)).rejects.toThrow(PencereIndexError);
  });
});
