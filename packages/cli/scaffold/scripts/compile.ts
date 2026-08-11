import { compileAutoMovieProduction } from "@automovie/mcp";

import config from "../automovie.config";
import { productionArchetypes } from "./archetypes";

const output = compileAutoMovieProduction({
  projectRoot: process.cwd(),
  productionId: config.productionId,
  scope: "source",
  archetypes: productionArchetypes,
});
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
