import fs from "node:fs/promises";

import { referenceControlNet } from "../../src/subjects/generated-korean-girl-01/controlNet";

// Freeze only the measured target facts consumed by the offline correspondence
// solve. This does not export or modify the anatomical source capture.
void fs.writeFile(
  ".shots/face-experiment/surface-study/target.json",
  JSON.stringify(referenceControlNet),
);
