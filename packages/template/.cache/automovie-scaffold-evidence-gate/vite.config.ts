import { defineConfig } from "vite";

import config from "./automovie.config";
import { createProductionFrameCaptureRuntime } from "./scripts/capture";
import { inspectCurrentCaptureRuntimeClosure } from "./scripts/capture-browser";
import { createProductionCaptureDialogueRuntime } from "./scripts/captureDialogueRuntime";
import { generatedShotPlugin } from "./scripts/generatedShotPlugin";

/** Local deterministic viewer; generated artifacts remain ordinary files. */
export default defineConfig(async () => {
  const closure = inspectCurrentCaptureRuntimeClosure({
    projectRoot: process.cwd(),
    config: config.capture.browser,
  });
  if (closure.status === "not-ready") throw new Error(closure.correction);
  closure.assertCurrent();
  const captureRuntime = createProductionFrameCaptureRuntime();
  const dialogueRuntime = createProductionCaptureDialogueRuntime({
    capture: captureRuntime,
    productionId: config.productionId,
    root: process.cwd(),
  });
  await dialogueRuntime.prepare();
  closure.assertCurrent();
  return {
    root: ".",
    plugins: [
      generatedShotPlugin(process.cwd(), config.productionId, {
        dialogue: captureRuntime.dialogue,
        deliveryCrop: captureRuntime.deliveryCrop,
        prepare: async () => {
          closure.assertCurrent();
          await dialogueRuntime.prepare();
          closure.assertCurrent();
        },
      }),
    ],
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
  };
});
