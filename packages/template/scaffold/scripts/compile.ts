import {
  AUTOMOVIE_PRIMITIVE_ARCHETYPES,
  createAutoMovieArchetypeRegistry,
} from "@automovie/archetypes";
import { compileAutoMovieProduction } from "@automovie/production";

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

const output = compileAutoMovieProduction({
  projectRoot: process.cwd(),
  productionId,
  scope: "source",
  archetypes,
});
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
