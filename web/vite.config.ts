import { resolve } from "node:path"

import { nitro } from "nitro/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [nitro()],
  resolve: {
    alias: {
      pencere: resolve(__dirname, "../src/index.ts"),
      "pencere/react": resolve(__dirname, "../src/adapters/react.ts"),
      "pencere/vue": resolve(__dirname, "../src/adapters/vue.ts"),
      "pencere/svelte": resolve(__dirname, "../src/adapters/svelte.ts"),
      "pencere/solid": resolve(__dirname, "../src/adapters/solid.ts"),
      "pencere/element": resolve(__dirname, "../src/adapters/element.ts"),
    },
  },
})
