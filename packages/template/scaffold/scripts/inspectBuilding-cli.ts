import { readAutoMovieProductionEvidence } from "@automovie/evidence";
import type { IAutoMovieCompiledShotSource } from "@automovie/interface";
import { encodeAutoMoviePathSegment } from "@automovie/production";
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "automovie";
import fs from "node:fs";
import path from "node:path";

import { productionEvidence } from "../lint.config";
import { collectAutoMovieStagedRecords } from "./buildingDerivation";
import { inspectAutoMovieBuilding } from "./buildingInspection";
import { collectAutoMovieBuildingRecords } from "./buildingRecords";
import { assertAutoMovieNoArguments } from "./commandArguments";
import { productionPlacementStudies } from "./productionPlacementStudies";
import { currentAutoMovieProductionId } from "./projectIdentity";

assertAutoMovieNoArguments("building:inspect", process.argv.slice(2));
const productionId = currentAutoMovieProductionId();
const currentAuthoringEvidence = () =>
  readAutoMovieProductionEvidence({ root: process.cwd(), productionEvidence });
const state = requireCurrentAutoMovieProjectState(
  loadAutoMovieProjectState({
    root: process.cwd(),
    productionId,
    authoringEvidence: currentAuthoringEvidence(),
    currentAuthoringEvidence,
  }),
);
const records = collectAutoMovieBuildingRecords({
  materialized: [...state.generated.libraryEnvironments.values()],
  staged: collectAutoMovieStagedRecords({
    shots: [...state.generated.shots],
    select: (shot: IAutoMovieCompiledShotSource) => shot.builtEnvironments,
    what: "built environment",
  }),
});
for (const record of records) {
  const report = inspectAutoMovieBuilding({
    environment: record.environment,
    inputFingerprint: state.generated.manifest.inputFingerprint,
    study: productionPlacementStudies[record.environment.id],
  });
  const file = path.join(
    state.root,
    "reports",
    encodeAutoMoviePathSegment(record.environment.id),
    "inspection.json",
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify({ source: record.source, ...report }, null, 2) + "\n",
    "utf8",
  );
  process.stdout.write(
    JSON.stringify({
      file: path.relative(state.root, file),
      census: report.census,
      storage: report.storage,
      support: report.support.status,
      overlapCandidates: report.overlaps.pairs.length,
    }) + "\n",
  );
}
process.stdout.write(
  `${records.length} building record(s) inspected. Bounds candidates require interpretation; an empty population proves no placement claim.\n`,
);
