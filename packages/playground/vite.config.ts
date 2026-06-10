import { resolve } from "path";
import { defineConfig } from "vite";

// The workspace packages are consumed straight from TypeScript source (their
// package "main" points at src/*.ts), so Vite must transpile them too. Two
// pages: the character editor (index) and the engine-drivers demo (drivers).
export default defineConfig({
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        drivers: resolve(__dirname, "drivers.html"),
        human: resolve(__dirname, "human.html"),
        body: resolve(__dirname, "body.html"),
        stickman: resolve(__dirname, "stickman.html"),
        knight: resolve(__dirname, "knight.html"),
        spar: resolve(__dirname, "spar.html"),
        archery: resolve(__dirname, "archery.html"),
        impact: resolve(__dirname, "impact.html"),
        trampoline: resolve(__dirname, "trampoline.html"),
      },
    },
  },
});
