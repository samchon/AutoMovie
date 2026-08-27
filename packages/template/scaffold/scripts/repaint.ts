import {
  AutoMovieProductionContext,
  AutoMovieProductionRepaintService,
} from "@automovie/production";

import config from "../automovie.config";
import { captureProductionFrame, closeProductionFrameCapture } from "./capture";
import {
  readProductionRepaintShotArgument,
  selectProductionRepaintRequest,
} from "./productionConfiguration";
import { repaintProductionShot } from "./repaintAdapter";

/**
 * Derive one shot's repainted rendition from its deterministic source.
 *
 * `visualDelivery: "repainted"` makes the deterministic shot technical truth
 * and a derived rendition what the audience sees, and final publication refuses
 * a repainted delivery whose shots carry no verified repaint receipt. This is
 * where those receipts come from; without it that mode can be declared and
 * never satisfied.
 *
 * The model is not shipped and never will be. `scripts/repaintAdapter.ts` is
 * the seam this project fills, and everything else already holds: the runtime
 * verifies the deterministic source the rendition derives from, parses the
 * returned MP4, and commits a receipt binding compiler, source-render, control,
 * reference, adapter, parameter, and output identities.
 *
 * The CLI chooses only a shot. Its prompt, negative prompt, seed, strength,
 * controls, references, generator, rights, terms, cost, and consumer come from
 * the reviewed `visual.repaint` serialization in `automovie.config.ts`.
 * Rerolling therefore requires an authored config revision rather than an
 * ephemeral override. It replaces only the active rendition pointer; unchanged
 * deterministic truth keeps its own receipts.
 */
const args = process.argv.slice(2);
const shot = readProductionRepaintShotArgument(args);
const selected = selectProductionRepaintRequest(config.visual.repaint, shot);
const context = new AutoMovieProductionContext(
  captureProductionFrame,
  process.cwd(),
  config.productionId,
);
let repaintFailure: { error: unknown } | undefined;
try {
  const output = await new AutoMovieProductionRepaintService(
    repaintProductionShot,
    selected.generator,
  ).serve(context, {
    parameters: selected.request.parameters,
    productionId: config.productionId,
    references: [...selected.request.references],
    shot: selected.request.shot,
  });
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (output.repainted === false) process.exitCode = 1;
} catch (error) {
  repaintFailure = { error };
  throw error;
} finally {
  await closeProductionFrameCapture(repaintFailure);
}
