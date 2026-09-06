import { readAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  AutoMovieProductionContext,
  captureAutoMovieProductionFrame,
} from "@automovie/production";

import { productionEvidence } from "../lint.config";
import { createProductionFrameCaptureRuntime } from "./capture";
import { createProductionCaptureDialogueRuntime } from "./captureDialogueRuntime";
import { readAutoMoviePreviewArguments } from "./commandArguments";
import { currentAutoMovieProductionId } from "./projectIdentity";

const request = readAutoMoviePreviewArguments(process.argv.slice(2));

/** The production namespace this project declares in its own package manifest. */
const productionId = currentAutoMovieProductionId();

/**
 * This project's own graph-derived authoring identity, read the way
 * `compile` reads it. The compile identity includes the reviewed source owner
 * bindings, so a capture judged without the same declaration would read every
 * compiled production as stale.
 */
const currentAuthoringEvidence = () =>
  readAutoMovieProductionEvidence({
    root: productionEvidence.location,
    productionEvidence,
  });
const authoringEvidence = currentAuthoringEvidence();
const captureRuntime = createProductionFrameCaptureRuntime();
const dialogueRuntime = createProductionCaptureDialogueRuntime({
  capture: captureRuntime,
  productionId,
  root: process.cwd(),
  authoringEvidence,
  currentAuthoringEvidence,
});
const context = new AutoMovieProductionContext(
  captureRuntime.capture,
  process.cwd(),
  productionId,
  undefined,
  authoringEvidence,
  currentAuthoringEvidence,
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
