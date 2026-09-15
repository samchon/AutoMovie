import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { sourcePreviewCompilerPlugin } from "./preview/sourcePreviewCompilerPlugin";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Compile authored source in memory and serve the production's own scene. */
export default defineConfig({
  root: fileURLToPath(new URL("../public", import.meta.url)),
  publicDir: false,
  plugins: [sourcePreviewCompilerPlugin(root)],
  resolve: {
    alias: { "/src": fileURLToPath(new URL(".", import.meta.url)) },
    dedupe: ["three"],
  },
  server: {
    host: "127.0.0.1",
    open: true,
    watch: {
      awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 50 },
    },
  },
});
