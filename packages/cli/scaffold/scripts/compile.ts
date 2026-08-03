import { compileAutoMovieProduction } from "@automovie/mcp";

import config from "../automovie.config";

const output = compileAutoMovieProduction({
  projectRoot: process.cwd(),
  productionId: config.productionId,
  scope: "source",
});
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
