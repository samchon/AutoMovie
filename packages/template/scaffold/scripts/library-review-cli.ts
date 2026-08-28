import config from "../automovie.config";
import { productionEvidence } from "../productionEvidence.mjs";
import { runLibraryReviewCli, runLibraryReviewCommand } from "./library-review";

process.exitCode = runLibraryReviewCli({
  argv: process.argv.slice(2),
  evidence: productionEvidence,
  productionId: config.productionId,
  root: process.cwd(),
  run: runLibraryReviewCommand,
  stderr: process.stderr.write.bind(process.stderr),
  stdout: process.stdout.write.bind(process.stdout),
});
