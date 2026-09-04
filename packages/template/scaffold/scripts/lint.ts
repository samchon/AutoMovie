import { readAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";

import { productionEvidence } from "../lint.config";
import { readAutoMovieLintArguments } from "./commandArguments";
import { currentAutoMovieProductionId } from "./projectIdentity";

const request = readAutoMovieLintArguments(process.argv.slice(2));

/** The production namespace this project declares in its own package manifest. */
const productionId = currentAutoMovieProductionId();

/**
 * The scope this lint runs at, `review` unless `--scope <name>` says otherwise.
 *
 * `review` is the right default: it is the gate a finished production must
 * pass, and answering "is this film deliverable" is what `npm run lint` is for.
 * It is the wrong question for most of a production's life, though. A film
 * being built sequence by sequence has, by construction, shots whose reviews
 * are not complete, so a review-scope lint fails on the incomplete queue and
 * says nothing about whether the work so far is structurally sound. Without a
 * choice here the only in-progress check left is `lint:source`, which is a
 * TypeScript pass and runs none of the `automovie` rules.
 *
 * A scope selects which gates run; it is not a filter over the `phase` field a
 * diagnostic carries. `phase` names the pipeline stage that owns the
 * correction, so a consumed model asset is reported at the `source` phase
 * because a source import is what the author must stop, and that label says
 * nothing about which scope raised it. The clearest case is the evidence gate:
 * `review` and `final` report `review-evidence-missing` for a shot and for
 * each model the film stages, and `source` reports neither, because frames do
 * not exist yet at the stage that scope belongs to.
 */
const project = AutoMovieProductionProject.open(process.cwd(), productionId);
const currentAuthoringEvidence = () =>
  readAutoMovieProductionEvidence({
    root: process.cwd(),
    productionEvidence,
  });
const authoringEvidence = currentAuthoringEvidence();
const output = new AutoMovieProductionCompiler(
  project,
  authoringEvidence,
  currentAuthoringEvidence,
).lint({ scope: request.scope });
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
