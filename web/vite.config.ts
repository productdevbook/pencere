import { defineConfig } from "vite"

export default defineConfig({
  root: __dirname,
  server: {
    port: 5173,
    host: true,
  },
})
