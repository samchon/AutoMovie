import {
  findAutoMovieProjectRoot,
  generateAutoMovieDerivedArtifact,
} from "@automovie/mcp";

import { deriveUtf8LineIndex } from "../src/examples/derivedArtifacts";

const root = findAutoMovieProjectRoot(process.cwd());
const inputPath = "src/world/plaza.ts";
const result = generateAutoMovieDerivedArtifact({
  root,
  generator: "src/examples/derivedArtifacts.ts",
  inputs: [inputPath],
  output: ".automovie/derived/examples/plaza-line-index.json",
  encoding: "utf8",
  generate: (inputs) => {
    const input = inputs[inputPath];
    if (input === undefined)
      throw new Error(`Declared input "${inputPath}" was not supplied.`);
    return deriveUtf8LineIndex(input);
  },
});

process.stdout.write(
  `${result.changed ? "updated" : "current"} ${result.record.path} (${result.record.outputDigest})\n`,
);
