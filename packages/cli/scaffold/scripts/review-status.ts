import { AutoMovieProductionApplication } from "@automovie/mcp";

const app = new AutoMovieProductionApplication({
  projectRoot: process.cwd(),
});
app.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
app.openProject({ root: process.cwd() });
const output = app.inspectProject({});
process.stdout.write(`${JSON.stringify(output.reviews, null, 2)}\n`);
if (output.reviews.entries.some((entry) => entry.state !== "complete"))
  process.exitCode = 1;
