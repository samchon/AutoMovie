import { AutoMovieApplication } from "@automovie/mcp";

import config from "../automovie.config";

const app = new AutoMovieApplication({
  projectRoot: process.cwd(),
});
app.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
app.getGuideDocument({ name: "COMPILATION" });
app.openProject({
  root: process.cwd(),
  productionId: config.productionId,
});
const output = app.compileProject({ scope: "source" });
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
