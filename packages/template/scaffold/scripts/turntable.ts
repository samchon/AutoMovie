import {
  AutoMovieProductionContext,
  captureAutoMovieProductionTurntable,
} from "@automovie/production";

import { createProductionFrameCaptureRuntime } from "./capture";
import { currentAutoMovieProductionId } from "./projectIdentity";

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
const args = process.argv.slice(2);
const options = new Map<string, string>();
const positional: string[] = [];
for (let index = 0; index < args.length; ++index) {
  const argument = args[index]!;
  if (argument.startsWith("--")) {
    const value = args[++index];
    if (value === undefined || value.startsWith("--"))
      throw new Error(`${argument} requires a value.`);
    options.set(argument, value);
  } else positional.push(argument);
}
const asset = options.get("--asset") ?? positional[0];
if (asset === undefined || asset.trim() === "")
  throw new Error("turntable requires --asset <compiled-model-id>.");
const width =
  options.get("--width") === undefined
    ? undefined
    : Number(options.get("--width"));
const height =
  options.get("--height") === undefined
    ? undefined
    : Number(options.get("--height"));
const captureRuntime = createProductionFrameCaptureRuntime();
const context = new AutoMovieProductionContext(
  captureRuntime.capture,
  process.cwd(),
  productionId,
);
let captureFailure: { error: unknown } | undefined;
try {
  const output = await captureAutoMovieProductionTurntable(context, {
    asset,
    productionId,
    width,
    height,
  });
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (output.captured === false) process.exitCode = 1;
} catch (error) {
  captureFailure = { error };
  throw error;
} finally {
  await captureRuntime.close(captureFailure);
}
