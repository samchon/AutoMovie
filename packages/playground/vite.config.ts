import { defineConfig } from "vite";

// The workspace packages are consumed straight from TypeScript source (their
// package "main" points at src/*.ts), so Vite must transpile them too.
export default defineConfig({
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
});
