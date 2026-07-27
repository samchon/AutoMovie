import { defineConfig } from "vite";

import { generatedShotPlugin } from "./scripts/generatedShotPlugin";

/** Local deterministic viewer; generated artifacts remain ordinary files. */
export default defineConfig({
  root: ".",
  plugins: [generatedShotPlugin(process.cwd())],
  server: {
    host: "127.0.0.1",
  },
});
