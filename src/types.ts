export interface PencereItem {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  caption?: string;
}

export interface PencereOptions {
  items: PencereItem[];
  startIndex?: number;
}
