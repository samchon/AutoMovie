import { readAutoMovieProductionEvidence } from "@automovie/evidence";

import { productionEvidence } from "../lint.config";
import { runLibraryReviewCli, runLibraryReviewCommand } from "./library-review";
import { currentAutoMovieProductionId } from "./projectIdentity";

/** The production namespace this project declares in its own package manifest. */
const productionId = currentAutoMovieProductionId();

process.exitCode = runLibraryReviewCli({
  argv: process.argv.slice(2),
  evidence: productionEvidence,
  productionId,
  read: readAutoMovieProductionEvidence,
  root: process.cwd(),
  run: runLibraryReviewCommand,
  stderr: process.stderr.write.bind(process.stderr),
  stdout: process.stdout.write.bind(process.stdout),
});
