import { describe, expect, it } from "vitest";
import { createPencere, PencereIndexError } from "../src/index.ts";

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

  it("next() wraps around", () => {
    const p = createPencere({ items, startIndex: 2 });
    expect(p.next().src).toBe("a.jpg");
    expect(p.index).toBe(0);
  });

  it("prev() wraps around", () => {
    const p = createPencere({ items });
    expect(p.prev().src).toBe("c.jpg");
    expect(p.index).toBe(2);
  });

  it("goTo() jumps to a specific index", () => {
    const p = createPencere({ items });
    expect(p.goTo(1).alt).toBe("B");
    expect(p.index).toBe(1);
  });

  it("throws on empty items", () => {
    expect(() => createPencere({ items: [] })).toThrow(PencereIndexError);
  });

  it("throws on out-of-bounds startIndex", () => {
    expect(() => createPencere({ items, startIndex: 5 })).toThrow(PencereIndexError);
  });

  it("throws on out-of-bounds goTo", () => {
    const p = createPencere({ items });
    expect(() => p.goTo(99)).toThrow(PencereIndexError);
  });
});
