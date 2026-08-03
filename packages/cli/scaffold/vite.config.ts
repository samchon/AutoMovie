import { defineConfig } from "vite";

import config from "./automovie.config";
import { generatedShotPlugin } from "./scripts/generatedShotPlugin";

/** Local deterministic viewer; generated artifacts remain ordinary files. */
export default defineConfig({
  root: ".",
  plugins: [generatedShotPlugin(process.cwd(), config.productionId)],
  resolve: {
    dedupe: ["three"],
  },
  server: {
    host: config.viewer.host,
  },
});
