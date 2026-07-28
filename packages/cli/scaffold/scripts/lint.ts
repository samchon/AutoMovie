import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
} from "@automovie/mcp";

const project = AutoMovieProductionProject.open(process.cwd());
const review = new AutoMovieProductionReviewService(project);
const output = new AutoMovieProductionCompiler(project, (status) =>
  review.queue(status),
).lint({ scope: "source" });
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
