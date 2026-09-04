import { readAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "automovie";

import { productionEvidence } from "../lint.config";
import { assertAutoMovieNoArguments } from "./commandArguments";
import { runAutoMovieBuildingDerivation } from "./deriveBuilding";
import { currentAutoMovieProductionId } from "./projectIdentity";

assertAutoMovieNoArguments("building:report", process.argv.slice(2));

/**
 * Derive this project's buildings, with the world this host actually has.
 *
 * The derivation itself takes its world as arguments, so it can be run against
 * a compiled fixture rather than only against the process it happens to be in.
 * This file is the half that cannot be: it reads the current directory, the
 * project's own declared production namespace, and the evidence declaration
 * beside it, which is exactly the part a test would have to fake to reach the
 * other half.
 */
const productionId = currentAutoMovieProductionId();
const currentAuthoringEvidence = () =>
  readAutoMovieProductionEvidence({
    root: process.cwd(),
    productionEvidence,
  });
const authoringEvidence = currentAuthoringEvidence();

runAutoMovieBuildingDerivation({
  evidence: productionEvidence,
  productionId,
  read: readAutoMovieProductionEvidence,
  state: requireCurrentAutoMovieProjectState(
    loadAutoMovieProjectState({
      root: process.cwd(),
      productionId,
      authoringEvidence,
      currentAuthoringEvidence,
    }),
  ),
});
