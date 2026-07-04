import ttsc from "@ttsc/unplugin/vite";
import { resolve } from "path";
import { defineConfig } from "vite";

// The workspace packages are consumed straight from TypeScript source (their
// package "main" points at src/*.ts), so Vite must transpile them too. The
// @ttsc/unplugin adapter runs the same ttsc plugin pipeline Vite bundles
// through, so compiler-powered libraries (typia) transform in the browser build
// the same way they do under `ttsc`.
export default defineConfig({
  plugins: [ttsc()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    fs: { allow: [resolve(__dirname, "../..")] },
  },
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
        film: resolve(__dirname, "film.html"),
        launch: resolve(__dirname, "launch.html"),
        attach: resolve(__dirname, "attach.html"),
        gesture: resolve(__dirname, "gesture.html"),
        showcase: resolve(__dirname, "showcase.html"),
        archery: resolve(__dirname, "archery.html"),
        impact: resolve(__dirname, "impact.html"),
        trampoline: resolve(__dirname, "trampoline.html"),
        face: resolve(__dirname, "face.html"),
        head: resolve(__dirname, "head.html"),
      },
    },
  },
});
