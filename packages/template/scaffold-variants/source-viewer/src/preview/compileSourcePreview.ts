import { parentPort, workerData } from "node:worker_threads";
import { TtscCompiler } from "ttsc";

if (parentPort === null)
  throw new Error("Source preview compilation requires its viewer worker.");

const input: { root: string } = workerData;
parentPort.postMessage(
  new TtscCompiler({
    cwd: input.root,
    projectRoot: input.root,
    pluginConfigDir: input.root,
    tsconfig: "package.json",
    cacheDir: "node_modules/.cache/ttsc",
  }).compile(),
);
