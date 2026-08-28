import config from "../automovie.config";
import { createProductionFrameCaptureRuntime } from "./capture";
import { createProductionCaptureDialogueRuntime } from "./captureDialogueRuntime";
import { repaintProductionShot } from "./repaintAdapter";
import {
  createNodeProductionRepaintHost,
  runProductionRepaintCommand,
} from "./repaintCommand";

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
await runProductionRepaintCommand(process.argv.slice(2), config, () => {
  const captureRuntime = createProductionFrameCaptureRuntime();
  const dialogueRuntime = createProductionCaptureDialogueRuntime({
    capture: captureRuntime,
    productionId: config.productionId,
    root: process.cwd(),
  });
  const host = createNodeProductionRepaintHost({
    adapter: repaintProductionShot,
    capture: captureRuntime.capture,
    closeCapture: captureRuntime.close,
    root: process.cwd(),
    setExitCode: (value) => {
      process.exitCode = value;
    },
    stdout: (value) => process.stdout.write(value),
  });
  return {
    ...host,
    serve: async (invocation) => {
      await dialogueRuntime.prepare();
      return host.serve(invocation);
    },
  };
});
