import {
  AUTOMOVIE_PRIMITIVE_ARCHETYPES,
  createAutoMovieArchetypeRegistry,
} from "@automovie/archetypes";
import { readAutoMovieProductionEvidence } from "@automovie/evidence";
import { compileAutoMovieProduction } from "@automovie/production";

import { productionEvidence } from "../lint.config";
import { currentAutoMovieProductionId } from "./projectIdentity";

/** The production namespace this project declares in its own package manifest. */
const productionId = currentAutoMovieProductionId();

/**
 * The archetypes this production builds from.
 *
 * The compiler resolves every `archetype` in `automovie/design/shared/models` against
 * this registry and refuses a recipe naming anything outside it, so this is
 * where a production adds its own builder or drops one it never uses.
 */
const archetypes = createAutoMovieArchetypeRegistry(
  AUTOMOVIE_PRIMITIVE_ARCHETYPES,
);

/**
 * This project's own graph-derived authoring identity.
 *
 * The compiler reads the production shape from here. A library has no film,
 * no shot and no design tree, so without this declaration it would be compiled
 * down the film path and refused for records it was never going to carry; with
 * it, the reviewed design owners and their source branches are what gets
 * executed and published. A film or brief reads the same declaration and is
 * unaffected by it.
 *
 * The root comes from the declaration's own `location` rather than from the
 * working directory. The reader refuses a declaration belonging to another
 * root, and a project reached through a different spelling of the same
 * directory -- a Windows short path, a symlinked checkout -- is exactly the
 * case where two true paths compare unequal.
 */
const root = productionEvidence.location;
const currentAuthoringEvidence = () =>
  readAutoMovieProductionEvidence({ root, productionEvidence });
const authoringEvidence = currentAuthoringEvidence();

const output = compileAutoMovieProduction({
  projectRoot: root,
  productionId,
  scope: "source",
  archetypes,
  authoringEvidence,
  currentAuthoringEvidence,
});
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
