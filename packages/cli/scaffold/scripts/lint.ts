import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
} from "@automovie/mcp";

const project = AutoMovieProductionProject.open(process.cwd());
const review = new AutoMovieProductionReviewService(project);
const output = new AutoMovieProductionCompiler(project, (status, snapshot) =>
  review.queue(status, snapshot),
).lint({ scope: "review" });
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
