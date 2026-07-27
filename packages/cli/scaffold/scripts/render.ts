import { AutoMovieProductionApplication } from "@automovie/mcp";

import { captureProductionFrame } from "./capture";

const app = new AutoMovieProductionApplication({
  projectRoot: process.cwd(),
  capture: captureProductionFrame,
});
app.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
app.getGuideDocument({ name: "COMPILATION" });
app.getGuideDocument({ name: "PRODUCTION_RENDER" });
app.openProject({ root: process.cwd() });
const compiled = app.compileProject({ scope: "final" });
if (compiled.success === false) {
  process.stdout.write(`${JSON.stringify(compiled, null, 2)}\n`);
  process.exitCode = 1;
} else {
  const frame = await app.previewFrame({
    target: { kind: "shot", id: "opening" },
    time: 0,
    pass: "beauty",
  });
  process.stdout.write(`${JSON.stringify({ compiled, frame }, null, 2)}\n`);
  if (frame.captured === false) process.exitCode = 1;
}
