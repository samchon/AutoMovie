import { AutoMovieApplication } from "@automovie/mcp";

import config from "../automovie.config";

const app = new AutoMovieApplication({
  projectRoot: process.cwd(),
});
app.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
app.openProject({
  root: process.cwd(),
  productionId: config.productionId,
});
const output = app.inspectProject({});
process.stdout.write(`${JSON.stringify(output.reviews, null, 2)}\n`);
if (output.reviews.entries.some((entry) => entry.state !== "complete"))
  process.exitCode = 1;
