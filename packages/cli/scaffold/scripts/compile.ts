import { AutoMovieApplication } from "@automovie/mcp";

const app = new AutoMovieApplication({
  projectRoot: process.cwd(),
});
app.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
app.getGuideDocument({ name: "COMPILATION" });
app.openProject({ root: process.cwd() });
const output = app.compileProject({ scope: "source" });
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
