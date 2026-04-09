export type Listener<E> = (event: E) => void;

export class Emitter<Events extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof Events, Set<Listener<unknown>>>();

  on<K extends keyof Events>(key: K, fn: Listener<Events[K]>): () => void {
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(fn as Listener<unknown>);
    return () => this.off(key, fn);
  }

  off<K extends keyof Events>(key: K, fn: Listener<Events[K]>): void {
    const set = this.listeners.get(key);
    if (!set) return;
    set.delete(fn as Listener<unknown>);
    if (set.size === 0) this.listeners.delete(key);
  }

  emit<K extends keyof Events>(key: K, event: Events[K]): void {
    const set = this.listeners.get(key);
    if (!set) return;
    // Snapshot so that listeners added/removed during dispatch
    // do not affect the current emission.
    const snapshot = Array.from(set);
    for (const fn of snapshot) {
      (fn as Listener<Events[K]>)(event);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
