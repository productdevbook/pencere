import { describe, expect, it, vi } from "vitest";
import { Emitter } from "../src/index";

interface Events extends Record<string, unknown> {
  hello: { name: string };
  tick: number;
  done: undefined;
}

describe("Emitter", () => {
  it("delivers events to listeners", () => {
    const e = new Emitter<Events>();
    const fn = vi.fn();
    e.on("hello", fn);
    e.emit("hello", { name: "pencere" });
    expect(fn).toHaveBeenCalledWith({ name: "pencere" });
  });

  it("supports multiple listeners per key", () => {
    const e = new Emitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    e.on("tick", a);
    e.on("tick", b);
    e.emit("tick", 1);
    expect(a).toHaveBeenCalledWith(1);
    expect(b).toHaveBeenCalledWith(1);
  });

  it("on() returns an unsubscribe function", () => {
    const e = new Emitter<Events>();
    const fn = vi.fn();
    const off = e.on("tick", fn);
    off();
    e.emit("tick", 1);
    expect(fn).not.toHaveBeenCalled();
  });

  it("off() removes a specific listener", () => {
    const e = new Emitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    e.on("tick", a);
    e.on("tick", b);
    e.off("tick", a);
    e.emit("tick", 1);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith(1);
  });

  it("emit() on a key with no listeners is a no-op", () => {
    const e = new Emitter<Events>();
    expect(() => e.emit("done", undefined)).not.toThrow();
  });

  it("clear() removes all listeners", () => {
    const e = new Emitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    e.on("tick", a);
    e.on("hello", b);
    e.clear();
    e.emit("tick", 1);
    e.emit("hello", { name: "x" });
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it("adding a listener during emit does not fire it for the current event", () => {
    const e = new Emitter<Events>();
    const second = vi.fn();
    e.on("tick", () => {
      e.on("tick", second);
    });
    e.emit("tick", 1);
    expect(second).not.toHaveBeenCalled();
    e.emit("tick", 2);
    expect(second).toHaveBeenCalledWith(2);
  });
});
