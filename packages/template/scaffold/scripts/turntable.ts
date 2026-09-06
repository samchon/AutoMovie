import { readAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  AutoMovieProductionContext,
  captureAutoMovieProductionTurntable,
} from "@automovie/production";

import { productionEvidence } from "../lint.config";
import { createProductionFrameCaptureRuntime } from "./capture";
import { readAutoMovieTurntableArguments } from "./commandArguments";
import { currentAutoMovieProductionId } from "./projectIdentity";

const request = readAutoMovieTurntableArguments(process.argv.slice(2));

/** The production namespace this project declares in its own package manifest. */
const productionId = currentAutoMovieProductionId();

/**
 * Capture the complete view set one asset review is judged from.
 *
 * `preview` captures one shot frame you name, which is the right shape for a
 * question you already have. An asset review is the other shape: what it owes
 * is fixed by the contract rather than chosen by the author, so this takes only
 * the asset and draws the whole set. Choosing your own angles is how an object
 * gets covered without anyone opening the side the defect was on.
 *
 * `review-evidence-missing` names any view still absent at the model's current
 * fingerprint. A model whose design or source moved owes the set again; its
 * previous frames stay on disk and do not count.
 */
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
  const output = await captureAutoMovieProductionTurntable(context, {
    asset: request.asset,
    productionId,
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
