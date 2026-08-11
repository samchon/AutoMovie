import {
  AUTOMOVIE_PRIMITIVE_ARCHETYPES,
  createAutoMovieArchetypeRegistry,
} from "@automovie/archetypes";

/**
 * The archetypes this production builds from.
 *
 * The compiler resolves every `archetype` in `.automovie/design/models`
 * against this registry and refuses a recipe naming anything outside it, so
 * this is where a production adds its own builder or drops one it never uses.
 *
 * One owner, because three programs need the same answer and they run in
 * different processes. `compile.ts` builds the production, `emitDesign.ts`
 * emits the records it reads, and `scripts/mcp.ts` serves the host that
 * captures its frames. A registry declared beside only some of them is a
 * production that compiles with its own builder and then cannot be
 * photographed with it: the capture host reopens the same project against a
 * different catalogue and reports a mismatch that names neither the archetype
 * nor the registry it was missing from.
 */
export const productionArchetypes = createAutoMovieArchetypeRegistry(
  AUTOMOVIE_PRIMITIVE_ARCHETYPES,
);
