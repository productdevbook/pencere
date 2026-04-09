# pencere

> Modern, accessible, framework-agnostic lightbox — pure TypeScript, zero dependencies, ESM, tree-shakeable.

[![npm version](https://img.shields.io/npm/v/pencere?style=flat&colorA=18181B&colorB=F0DB4F)](https://npmjs.com/package/pencere)
[![npm downloads](https://img.shields.io/npm/dm/pencere?style=flat&colorA=18181B&colorB=F0DB4F)](https://npmjs.com/package/pencere)
[![bundle size](https://img.shields.io/bundlephobia/minzip/pencere?style=flat&colorA=18181B&colorB=F0DB4F)](https://bundlephobia.com/result?p=pencere)
[![license](https://img.shields.io/github/license/productdevbook/pencere?style=flat&colorA=18181B&colorB=F0DB4F)](LICENSE)

> [!IMPORTANT]
> Early development. API is not stable yet. Feedback welcome.

## Install

```bash
pnpm add pencere
```

## Quick start

```ts
import { createPencere } from "pencere";

const p = createPencere({
  items: [
    { src: "/a.jpg", alt: "A" },
    { src: "/b.jpg", alt: "B" },
  ],
});

p.next();
console.log(p.item);
```

## License

MIT © [productdevbook](https://github.com/productdevbook)
