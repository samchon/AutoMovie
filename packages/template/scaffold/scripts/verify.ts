import { readAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";

import { productionEvidence } from "../lint.config";
import { currentAutoMovieProductionId } from "./projectIdentity";

/** The production namespace this project declares in its own package manifest. */
const productionId = currentAutoMovieProductionId();

const project = AutoMovieProductionProject.openReadOnly(
  process.cwd(),
  productionId,
);
const authoringEvidence = readAutoMovieProductionEvidence({
  root: process.cwd(),
  productionEvidence,
});
const output = new AutoMovieProductionCompiler(project, authoringEvidence).lint(
  {
    scope: "final",
  },
);
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
