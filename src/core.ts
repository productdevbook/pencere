import { Emitter } from "./emitter"
import { PencereIndexError, PencereStateError } from "./errors"
import type { CloseReason, Item, PencereEvents, PencereOptions } from "./types"

export interface PencereState<T extends Item = Item> {
  readonly items: readonly T[]
  readonly index: number
  readonly isOpen: boolean
}

export class Pencere<T extends Item = Item> {
  readonly events: Emitter<PencereEvents<T>> = new Emitter<PencereEvents<T>>()
  private items: T[]
  private loop: boolean
  private currentIndex: number
  private opened = false

  constructor(options: PencereOptions<T>) {
    this.items = [...options.items]
    this.loop = options.loop ?? true
    this.currentIndex = options.startIndex ?? 0
    if (this.items.length === 0) {
      throw new PencereIndexError(0, 0)
    }
    if (this.currentIndex < 0 || this.currentIndex >= this.items.length) {
      throw new PencereIndexError(this.currentIndex, this.items.length)
    }
  }

  get state(): PencereState<T> {
    return {
      items: this.items,
      index: this.currentIndex,
      isOpen: this.opened,
    }
  }

  get item(): T {
    return this.items[this.currentIndex]!
  }

  setItems(items: T[]): void {
    if (items.length === 0) {
      throw new PencereIndexError(0, 0)
    }
    this.items = [...items]
    if (this.currentIndex >= this.items.length) {
      this.currentIndex = this.items.length - 1
    }
  }

  async open(index?: number): Promise<void> {
    if (this.opened) return
    const target = index ?? this.currentIndex
    if (target < 0 || target >= this.items.length) {
      throw new PencereIndexError(target, this.items.length)
    }
    this.currentIndex = target
    this.events.emit("beforeOpen", { index: target, item: this.item })
    this.opened = true
    this.events.emit("open", { index: target, item: this.item })
  }

  async close(reason: CloseReason = "api"): Promise<void> {
    if (!this.opened) return
    this.events.emit("beforeClose", { reason })
    this.opened = false
    this.events.emit("close", { reason })
  }

  async goTo(index: number): Promise<void> {
    if (!this.opened) {
      throw new PencereStateError("Cannot goTo() before open()")
    }
    if (index < 0 || index >= this.items.length) {
      throw new PencereIndexError(index, this.items.length)
    }
    if (index === this.currentIndex) return
    const from = this.currentIndex
    this.events.emit("beforeChange", { from, to: index })
    this.currentIndex = index
    this.events.emit("change", { from, to: index, item: this.item })
  }

  /**
   * Advance to the next slide. At the last index with `loop: false`,
   * resolves as a silent no-op — no `change` event is emitted and
   * no error is thrown. Consumers that need to detect the boundary
   * should check `state.index === state.items.length - 1` first, or
   * disable their Next button at the edge (as the DOM viewer does).
   */
  async next(): Promise<void> {
    const n = this.items.length
    const target = this.currentIndex + 1
    if (target >= n) {
      if (!this.loop) return
      await this.goTo(0)
      return
    }
    await this.goTo(target)
  }

  /**
   * Step to the previous slide. At index 0 with `loop: false`,
   * resolves as a silent no-op — same contract as `next()`.
   */
  async prev(): Promise<void> {
    const target = this.currentIndex - 1
    if (target < 0) {
      if (!this.loop) return
      await this.goTo(this.items.length - 1)
      return
    }
    await this.goTo(target)
  }

  destroy(): void {
    this.opened = false
    this.events.emit("destroy", undefined)
    this.events.clear()
  }
}
