import { readAutoMovieProductionEvidence } from "@automovie/evidence";

import config from "../automovie.config";
import { productionEvidence } from "../lint.config";
import { runLibraryReviewCli, runLibraryReviewCommand } from "./library-review";

process.exitCode = runLibraryReviewCli({
  argv: process.argv.slice(2),
  evidence: productionEvidence,
  productionId: config.productionId,
  read: readAutoMovieProductionEvidence,
  root: process.cwd(),
  run: runLibraryReviewCommand,
  stderr: process.stderr.write.bind(process.stderr),
  stdout: process.stdout.write.bind(process.stdout),
});
