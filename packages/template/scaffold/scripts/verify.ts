import { readAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";

import config from "../automovie.config";
import { productionEvidence } from "../productionEvidence.mjs";

const project = AutoMovieProductionProject.openReadOnly(
  process.cwd(),
  config.productionId,
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
