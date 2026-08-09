import {
  AUTOMOVIE_PRIMITIVE_ARCHETYPES,
  createAutoMovieArchetypeRegistry,
} from "@automovie/archetypes";
import { compileAutoMovieProduction } from "@automovie/mcp";

import config from "../automovie.config";

/**
 * The archetypes this production builds from.
 *
 * The compiler resolves every `archetype` in `.automovie/design/models`
 * against this registry and refuses a recipe naming anything outside it, so
 * this is where a production adds its own builder or drops one it never uses.
 */
const archetypes = createAutoMovieArchetypeRegistry(
  AUTOMOVIE_PRIMITIVE_ARCHETYPES,
);

const output = compileAutoMovieProduction({
  projectRoot: process.cwd(),
  productionId: config.productionId,
  scope: "source",
  archetypes,
});
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
