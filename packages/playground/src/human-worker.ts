/// <reference lib="webworker" />
import {
  buildHumanFace,
  exportHumanFace,
  parseHumanFaceDocument,
} from "@automovie/human";

import { createHumanFaceWorkerHandler } from "./human/workerHandler";

const scope = self as unknown as DedicatedWorkerGlobalScope;
const handle = createHumanFaceWorkerHandler({
  parse: parseHumanFaceDocument,
  build: buildHumanFace,
  export: exportHumanFace,
  send: (reply, transfer) => scope.postMessage(reply, { transfer }),
});
scope.onmessage = (event: MessageEvent<{ document: string }>) =>
  handle(event.data.document);
