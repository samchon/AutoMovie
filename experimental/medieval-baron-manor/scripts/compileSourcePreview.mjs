import { parentPort, workerData } from "node:worker_threads";
import { TtscCompiler } from "ttsc";

if (parentPort === null)
  throw new Error("Source preview compilation requires its viewer worker.");

/**
 * @typedef {object} SourcePreviewWorkerInput
 * @property {string} root
 */
/** @type {SourcePreviewWorkerInput} */
const input = workerData;
parentPort.postMessage(
  new TtscCompiler({
    cwd: input.root,
    projectRoot: input.root,
    pluginConfigDir: input.root,
    tsconfig: "tsconfig.preview.json",
    cacheDir: "node_modules/.cache/ttsc",
  }).compile(),
);
