import type { IAutoMovieModel } from "@automovie/interface";
import { findAutoMovieProjectRoot } from "@automovie/production";
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "automovie";

import { assertAutoMovieNoArguments } from "./commandArguments";
import { readAutoMovieProjectProductionId } from "./projectIdentity";
import {
  type IAutoMovieTextureScaleSubject,
  autoMovieTextureScaleLines,
  deriveAutoMovieTextureScaleReport,
} from "./textureScaleReport";

assertAutoMovieNoArguments("texture:scale", process.argv.slice(2));

/** The project this invocation belongs to, found from the host's own seed. */
const projectRoot = findAutoMovieProjectRoot(process.cwd());

/** The production namespace that project declares in its own package manifest. */
const productionId = readAutoMovieProjectProductionId(projectRoot);

/**
 * Measure the texture scale of every model this build produced.
 *
 * ## Why this is a script and not a compile step
 *
 * The same reason the building report is one. A finish reading at the wrong
 * size is not a compiler error — the model is well formed and the frame draws —
 * and the answer is not part of a frame either, so it is not compiler output.
 * Shot source cannot ask the question at all: a build function runs in a
 * deterministic no-I/O sandbox over a published engine surface that
 * deliberately excludes this validator. So this is the third place, an ordinary
 * Node script with the whole engine available, reading compiler-owned state.
 *
 * ## What it reads
 *
 * Current generated state, never source, and every model in it: the models a
 * shot program returned, whose parts carry meshes this production's own source
 * built, and the models the compiler materialized from recipes. The second set
 * is included because "every model the build produced" is the claim, and a set
 * excluded by guesswork is a set nobody can prove was empty.
 *
 * Requiring the state to be `current` is what makes the reading true. A stale
 * compile would measure surfaces the source no longer builds.
 *
 * ## What it writes
 *
 * Nothing. It prints, and it exits non-zero when a binding contradicts the
 * geometry it was bound to. A tile too large for its surface is a warning and
 * does not fail the run, because that same geometry is how one image is
 * legitimately fitted to a single face.
 */
const state = requireCurrentAutoMovieProjectState(
  loadAutoMovieProjectState({
    root: projectRoot,
    productionId,
  }),
);

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/**
 * Every model the build produced, once each.
 *
 * A model staged by twelve shots is one model, and measuring it twelve times
 * would print one fault twelve times and inflate every number in the census.
 * The compiler copies a source's own declaration into every artifact that
 * stages it, so the id is the identity.
 *
 * Two different records wearing one id is a different fact and is refused
 * rather than resolved by read order, exactly as the building report refuses
 * it: a measurement taken from whichever shot happened to be read first is
 * evidence nobody can act on.
 */
const collect = (): IAutoMovieTextureScaleSubject[] => {
  const found = new Map<
    string,
    { subject: IAutoMovieTextureScaleSubject; json: string }
  >();
  const add = (origin: string, model: IAutoMovieModel): void => {
    const json = JSON.stringify(model);
    const seen = found.get(model.id);
    if (seen === undefined) {
      found.set(model.id, { subject: { origin, model }, json });
      return;
    }
    if (seen.json !== json)
      throw new Error(
        `"${seen.subject.origin}" and "${origin}" carry two different model records under the id "${model.id}". One id is one model; rename one of them, or share the source that emits it.`,
      );
    // One record reached here from several places, which is the ordinary case:
    // a recipe the compiler materialized is also carried by every shot that
    // stages it. The smallest origin wins so the reported one is a property of
    // the build rather than of the order the loader happened to hand them over.
    if (compareCodeUnits(origin, seen.subject.origin) < 0)
      found.set(model.id, { subject: { origin, model }, json });
  };
  for (const [shot, compiled] of state.generated.shots)
    for (const model of compiled.models) add(`shot:${shot}`, model);
  for (const [recipe, model] of state.generated.models)
    add(`recipe:${recipe}`, model);
  return [...found.values()]
    .map((entry) => entry.subject)
    .sort((left, right) => compareCodeUnits(left.model.id, right.model.id));
};

const subjects = collect();
const report = deriveAutoMovieTextureScaleReport({ subjects });
for (const line of autoMovieTextureScaleLines(report))
  process.stdout.write(`${line}\n`);
if (report.errors.length !== 0) process.exitCode = 1;
