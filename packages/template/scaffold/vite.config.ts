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
    watch: {
      // A production authors its images into `assets/` while this server is
      // watching the same tree, so the watcher will meet a half-written PNG
      // sooner or later and take the whole server down with it. Waiting for
      // the size to settle is what makes authoring and viewing able to run at
      // the same time, which is the way the scaffold expects to be used.
      awaitWriteFinish: {
        stabilityThreshold: 400,
        pollInterval: 50,
      },
    },
  },
});
