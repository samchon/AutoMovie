import { readAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  encodeAutoMoviePathSegment,
} from "@automovie/production";
import fs from "node:fs";
import path from "node:path";

import { productionEvidence } from "../lint.config";
import { assertAutoMovieNoArguments } from "./commandArguments";
import { captureExistingRenderPlan } from "./renderPlanSnapshot";

assertAutoMovieNoArguments("verify", process.argv.slice(2));

const project = AutoMovieProductionProject.openReadOnly(process.cwd());
const productionId = project.productionId;
const currentAuthoringEvidence = () =>
  readAutoMovieProductionEvidence({
    root: process.cwd(),
    productionEvidence,
  });
const authoringEvidence = currentAuthoringEvidence();
const finalStateRoot = path.join(
  project.root,
  "automovie",
  "productions",
  encodeAutoMoviePathSegment(productionId),
  "render-job",
  "final",
);
const finalRenderPlanSnapshot = fs.existsSync(finalStateRoot)
  ? captureExistingRenderPlan(
      finalStateRoot,
      path.join(finalStateRoot, "plan.json"),
    )
  : null;
const output = new AutoMovieProductionCompiler(
  project,
  authoringEvidence,
  currentAuthoringEvidence,
  finalRenderPlanSnapshot?.plan,
).lint({ scope: "final" });
if (finalRenderPlanSnapshot !== null) {
  const current = captureExistingRenderPlan(
    finalStateRoot,
    path.join(finalStateRoot, "plan.json"),
  );
  if (
    current === null ||
    current.generation !== finalRenderPlanSnapshot.generation ||
    current.snapshot.target !== finalRenderPlanSnapshot.snapshot.target ||
    current.snapshot.targetIdentity !==
      finalRenderPlanSnapshot.snapshot.targetIdentity ||
    current.snapshot.targetVersion !==
      finalRenderPlanSnapshot.snapshot.targetVersion ||
    current.snapshot.fileDigest !==
      finalRenderPlanSnapshot.snapshot.fileDigest
  )
    throw new Error(
      "The current final render-plan generation changed during verification. Retry npm run verify.",
    );
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
