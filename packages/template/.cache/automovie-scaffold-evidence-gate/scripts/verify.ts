import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";

import config from "../automovie.config";

const project = AutoMovieProductionProject.openReadOnly(
  process.cwd(),
  config.productionId,
);
const output = new AutoMovieProductionCompiler(project).lint({
  scope: "final",
});
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
