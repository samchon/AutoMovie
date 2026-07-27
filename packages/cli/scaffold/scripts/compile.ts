import { AutoMovieProductionApplication } from "@automovie/mcp";

const app = new AutoMovieProductionApplication({
  projectRoot: process.cwd(),
});
app.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
app.getGuideDocument({ name: "COMPILATION" });
app.openProject({ root: process.cwd() });
const output = app.compileProject({ scope: "source" });
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
