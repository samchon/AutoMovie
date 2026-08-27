import type { IAutoMovieRepaintReferenceInput } from "@automovie/interface";
import {
  AutoMovieProductionContext,
  AutoMovieProductionRepaintService,
} from "@automovie/production";

import config from "../automovie.config";
import { captureProductionFrame, closeProductionFrameCapture } from "./capture";
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
 * Every option maps to one field of the typed repaint contract rather than to a
 * format invented here, and each reference names a path the asset manifest
 * already registers. Rerolling replaces only the active rendition pointer;
 * unchanged deterministic truth keeps its own receipts.
 */
const args = process.argv.slice(2);
const options = new Map<string, string>();
const references: IAutoMovieRepaintReferenceInput[] = [];
const positional: string[] = [];
for (let index = 0; index < args.length; ++index) {
  const argument = args[index]!;
  if (argument.startsWith("--") === false) {
    positional.push(argument);
    continue;
  }
  const value = args[++index];
  if (value === undefined || value.startsWith("--"))
    throw new Error(`${argument} requires a value.`);
  if (argument === "--style" || argument === "--character")
    references.push({ path: value, role: argument.slice(2) as "style" });
  else options.set(argument, value);
}
const shot = options.get("--shot") ?? positional[0];
if (shot === undefined || shot.trim() === "")
  throw new Error("repaint requires --shot <authored-shot-id>.");
const prompt = options.get("--prompt");
if (prompt === undefined || prompt.trim() === "")
  throw new Error("repaint requires --prompt <text>.");
const numeric = (name: string): number => {
  const raw = options.get(name);
  if (raw === undefined) throw new Error(`repaint requires ${name} <number>.`);
  const parsed = Number(raw);
  if (Number.isFinite(parsed) === false)
    throw new Error(`${name} must be a finite number; received "${raw}".`);
  return parsed;
};
// Seed and strength are required rather than defaulted. A default would make
// two runs of "the same" command produce different bytes while both look
// reproducible, which is the one thing a rendition receipt exists to prevent.
const seed = numeric("--seed");
const strength = numeric("--strength");
const negativePrompt = options.get("--negative");
const context = new AutoMovieProductionContext(
  captureProductionFrame,
  process.cwd(),
  config.productionId,
);
let repaintFailure: { error: unknown } | undefined;
try {
  const output = await new AutoMovieProductionRepaintService(
    repaintProductionShot,
  ).serve(context, {
    parameters: {
      prompt,
      seed,
      strength,
      ...(negativePrompt === undefined ? {} : { negativePrompt }),
    },
    productionId: config.productionId,
    references,
    shot,
  });
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (output.repainted === false) process.exitCode = 1;
} catch (error) {
  repaintFailure = { error };
  throw error;
} finally {
  await closeProductionFrameCapture(repaintFailure);
}
