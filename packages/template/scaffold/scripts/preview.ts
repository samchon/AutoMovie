import {
  AutoMovieProductionContext,
  captureAutoMovieProductionFrame,
} from "@automovie/production";

import { createProductionFrameCaptureRuntime } from "./capture";
import { createProductionCaptureDialogueRuntime } from "./captureDialogueRuntime";
import { readAutoMoviePreviewArguments } from "./commandArguments";
import { currentAutoMovieProductionId } from "./projectIdentity";

const request = readAutoMoviePreviewArguments(process.argv.slice(2));

/** The production namespace this project declares in its own package manifest. */
const productionId = currentAutoMovieProductionId();
const captureRuntime = createProductionFrameCaptureRuntime();
const dialogueRuntime = createProductionCaptureDialogueRuntime({
  capture: captureRuntime,
  productionId,
  root: process.cwd(),
});
const context = new AutoMovieProductionContext(
  captureRuntime.capture,
  process.cwd(),
  productionId,
);
let captureFailure: { error: unknown } | undefined;
try {
  await dialogueRuntime.prepare();
  const output = await captureAutoMovieProductionFrame(context, {
    target: {
      kind: "shot",
      productionId,
      id: request.shot,
      time: request.time,
      pass: request.pass,
    },
    width: request.width,
    height: request.height,
  });
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (output.captured === false) process.exitCode = 1;
} catch (error) {
  captureFailure = { error };
  throw error;
} finally {
  await captureRuntime.close(captureFailure);
}
