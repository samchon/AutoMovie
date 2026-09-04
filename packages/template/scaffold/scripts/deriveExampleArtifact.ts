import {
  findAutoMovieProjectRoot,
  generateAutoMovieDerivedArtifact,
} from "@automovie/production";

import { assertAutoMovieNoArguments } from "./commandArguments";

assertAutoMovieNoArguments("derive:example", process.argv.slice(2));

/**
 * Explicit deterministic precomputation, run by `npm run derive:example`.
 *
 * This script is the declared generator, so its own bytes are part of the
 * recorded basis: editing what it computes, what it reads, or where it writes
 * makes the published artifact stale and the next compile refuses it. That is
 * why the derivation is inlined here instead of imported from
 * `src/examples/derivedArtifacts.ts` -- a generator that delegates to a module
 * outside its own basis can change behavior without changing the digest, and
 * deleting the example after reading it would break this command.
 */
const INPUT_PATH = "src/examples/buildings.ts";

const deriveUtf8LineIndex = (input: Uint8Array): Uint8Array => {
  new TextDecoder("utf-8", { fatal: true }).decode(input);
  const starts = [0];
  for (let index = 0; index < input.length; ++index)
    if (input[index] === 0x0a && index + 1 < input.length)
      starts.push(index + 1);
  return new TextEncoder().encode(
    `${JSON.stringify({ byteLength: input.length, lineStarts: starts })}\n`,
  );
};

const result = generateAutoMovieDerivedArtifact({
  root: findAutoMovieProjectRoot(process.cwd()),
  generator: "scripts/deriveExampleArtifact.ts",
  inputs: [INPUT_PATH],
  output: "automovie/derived/examples/buildings-line-index.json",
  encoding: "utf8",
  generate: (inputs) => {
    const input = inputs[INPUT_PATH];
    if (input === undefined)
      throw new Error(`Declared input "${INPUT_PATH}" was not supplied.`);
    return deriveUtf8LineIndex(input);
  },
});

process.stdout.write(
  `${result.changed ? "updated" : "current"} ${result.record.path} (${result.record.outputDigest})\n`,
);
