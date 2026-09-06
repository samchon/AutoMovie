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
import {
  assertRenderPlanHead,
  captureExistingRenderPlan,
} from "./renderPlanSnapshot";

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
// The verdict above was judged against the final plan generation captured
// before the compiler ran. If that generation moved while it ran, the verdict
// describes a plan that no longer exists and must not be printed as current.
if (finalRenderPlanSnapshot !== null)
  try {
    assertRenderPlanHead(
      finalStateRoot,
      path.join(finalStateRoot, "plan.json"),
      finalRenderPlanSnapshot,
    );
  } catch {
    throw new Error(
      "The current final render-plan generation changed during verification. Retry npm run verify.",
    );
  }
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
