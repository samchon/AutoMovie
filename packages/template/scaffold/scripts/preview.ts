import type { AutoMovieGuidePass } from "@automovie/interface";
import {
  AutoMovieProductionContext,
  captureAutoMovieProductionFrame,
} from "@automovie/production";

import { createProductionFrameCaptureRuntime } from "./capture";
import { createProductionCaptureDialogueRuntime } from "./captureDialogueRuntime";
import { currentAutoMovieProductionId } from "./projectIdentity";

/** The production namespace this project declares in its own package manifest. */
const productionId = currentAutoMovieProductionId();

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
const time = Number(options.get("--time") ?? positional[0] ?? "0");
const shot = options.get("--shot") ?? positional[1];
if (shot === undefined || shot.trim() === "")
  throw new Error("preview requires --shot <authored-shot-id>.");
const passValue = options.get("--pass") ?? "beauty";
const passes: readonly AutoMovieGuidePass[] = [
  "beauty",
  "depth",
  "mask",
  "normal",
  "outline",
  "pose",
];
if (passes.includes(passValue as AutoMovieGuidePass) === false)
  throw new Error(
    `--pass must be one of ${passes.join(", ")}; received "${passValue}".`,
  );
const pass = passValue as AutoMovieGuidePass;
const width =
  options.get("--width") === undefined
    ? undefined
    : Number(options.get("--width"));
const height =
  options.get("--height") === undefined
    ? undefined
    : Number(options.get("--height"));
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
      id: shot,
      time,
      pass,
    },
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
