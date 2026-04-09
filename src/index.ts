export type { PencereItem, PencereOptions } from "./types.ts";
export { PencereError, PencereIndexError } from "./errors.ts";

import { PencereIndexError } from "./errors.ts";
import type { PencereItem, PencereOptions } from "./types.ts";

export function createPencere(options: PencereOptions) {
  const items = options.items;
  let current = options.startIndex ?? 0;

  if (items.length === 0) {
    throw new PencereIndexError(0, 0);
  }
  if (current < 0 || current >= items.length) {
    throw new PencereIndexError(current, items.length);
  }

  return {
    get index(): number {
      return current;
    },
    get item(): PencereItem {
      return items[current]!;
    },
    get length(): number {
      return items.length;
    },
    next(): PencereItem {
      current = (current + 1) % items.length;
      return items[current]!;
    },
    prev(): PencereItem {
      current = (current - 1 + items.length) % items.length;
      return items[current]!;
    },
    goTo(index: number): PencereItem {
      if (index < 0 || index >= items.length) {
        throw new PencereIndexError(index, items.length);
      }
      current = index;
      return items[current]!;
    },
  };
}
