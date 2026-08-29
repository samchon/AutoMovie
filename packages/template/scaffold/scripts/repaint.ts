import { AutoMovieProductionProject } from "@automovie/production";

import { repaintSelectionReviews } from "../repaintSelectionReviews";
import { createProductionFrameCaptureRuntime } from "./capture";
import { createProductionCaptureDialogueRuntime } from "./captureDialogueRuntime";
import { productionRepaintInput } from "./productionConfiguration";
import { currentAutoMovieProductionId } from "./projectIdentity";
import { repaintProductionShot } from "./repaintAdapter";
import { createProductionRepaintCancellationRuntime } from "./repaintCancellationRuntime";
import {
  createNodeProductionRepaintHost,
  runProductionRepaintCommand,
} from "./repaintCommand";

/** The production namespace this project declares in its own package manifest. */
const productionId = currentAutoMovieProductionId();

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
 * The CLI exposes four explicit operations. A reroll creates a new request
 * from the current reviewed configuration, while retry repeats an existing
 * request only after its latest terminal failure remains retryable under the
 * unchanged policy. A success closes that request, so another candidate needs
 * a reroll; both operations leave a successful candidate inactive. Select
 * advances the active pointer; reverse moves it to a prior verified candidate.
 * Deterministic truth retains its own receipts throughout those transitions.
 */
await runProductionRepaintCommand(
  process.argv.slice(2),
  {
    productionId,
    repaint: productionRepaintInput(
      AutoMovieProductionProject.productionDesign(process.cwd(), productionId)
        ?.repaint,
      repaintSelectionReviews,
    ),
  },
  () => {
    const captureRuntime = createProductionFrameCaptureRuntime();
    const cancellation = createProductionRepaintCancellationRuntime(process);
    const dialogueRuntime = createProductionCaptureDialogueRuntime({
      capture: captureRuntime,
      productionId,
      root: process.cwd(),
    });
    const host = createNodeProductionRepaintHost({
      adapter: repaintProductionShot,
      capture: captureRuntime.capture,
      closeCapture: (failure) =>
        cancellation.closeCapture(failure, captureRuntime.close),
      root: process.cwd(),
      signal: cancellation.signal,
      setExitCode: (value) => {
        process.exitCode = value;
      },
      stdout: (value) => process.stdout.write(value),
    });
    cancellation.attach();
    return {
      ...host,
      serve: async (invocation) => {
        if (invocation.kind === "reroll" || invocation.kind === "retry")
          await dialogueRuntime.prepare();
        return host.serve(invocation);
      },
    };
  },
);
