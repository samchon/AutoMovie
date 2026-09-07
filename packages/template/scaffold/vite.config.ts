import { defineConfig } from "vite";

import { createProductionFrameCaptureRuntime } from "./scripts/capture";
import { inspectCurrentCaptureRuntimeClosure } from "./scripts/capture-browser";
import { createProductionCaptureDialogueRuntime } from "./scripts/captureDialogueRuntime";
import { generatedShotPlugin } from "./scripts/generatedShotPlugin";
import {
  readAutoMovieHostCaptureBrowser,
  readAutoMovieHostViewerHost,
} from "./scripts/hostBoundary";
import { liveCompilerPlugin } from "./scripts/liveCompilerPlugin";
import { currentAutoMovieProductionId } from "./scripts/projectIdentity";

/** Local deterministic viewer; generated artifacts remain ordinary files. */
export default defineConfig(({ mode }) => {
  const sourcePreview = mode === "source-preview";
  const root = process.cwd();
  const captureRuntime = createProductionFrameCaptureRuntime();
  return {
    root: ".",
    plugins: sourcePreview
      ? []
      : [
          liveCompilerPlugin(root),
          generatedShotPlugin(root, currentAutoMovieProductionId(), {
            dialogue: captureRuntime.dialogue,
            deliveryCrop: captureRuntime.deliveryCrop,
            prepare: async () => {
              // Preparation belongs to a request for admitted compiler output.
              // Keeping it lazy lets the server stay open through source errors.
              const closure = inspectCurrentCaptureRuntimeClosure({
                projectRoot: root,
                config: readAutoMovieHostCaptureBrowser(process.env),
              });
              if (closure.status === "not-ready")
                throw new Error(closure.correction);
              closure.assertCurrent();
              await createProductionCaptureDialogueRuntime({
                capture: captureRuntime,
                productionId: currentAutoMovieProductionId(),
                root,
              }).prepare();
              closure.assertCurrent();
            },
          }),
        ],
    resolve: {
      dedupe: ["three"],
    },
    server: {
      host: readAutoMovieHostViewerHost(process.env),
      open: sourcePreview ? "/viewer/preview.html" : "/viewer/",
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
