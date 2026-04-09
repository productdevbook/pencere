export class PencereError extends Error {
  override name = "PencereError";
}

export class PencereIndexError extends PencereError {
  override name = "PencereIndexError";
  constructor(index: number, length: number) {
    super(`Index ${index} out of bounds (0..${length - 1})`);
  }
}
