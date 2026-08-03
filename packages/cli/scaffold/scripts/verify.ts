import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
} from "@automovie/mcp";

import config from "../automovie.config";

const project = AutoMovieProductionProject.openReadOnly(
  process.cwd(),
  config.productionId,
);
const review = new AutoMovieProductionReviewService(project);
const output = new AutoMovieProductionCompiler(project, (status, snapshot) =>
  review.queue(status, snapshot),
).lint({ scope: "final" });
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
