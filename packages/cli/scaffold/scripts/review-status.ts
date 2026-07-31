import {
  inspectAutoMovieProduction,
  openAutoMovieProduction,
} from "@automovie/mcp";

import config from "../automovie.config";

const output = inspectAutoMovieProduction(
  openAutoMovieProduction({
    projectRoot: process.cwd(),
    productionId: config.productionId,
  }),
);
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (
  output.diagnostics.some((diagnostic) => diagnostic.category === "error") ||
  output.reviews.entries.some((entry) => entry.state !== "complete")
)
  process.exitCode = 1;
