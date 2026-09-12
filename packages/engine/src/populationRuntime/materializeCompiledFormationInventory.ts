import {
  IAutoMovieCompiledFormation,
  IAutoMovieFormationDesign,
  IAutoMovieModelRecipe,
  IAutoMovieWorldSurface,
} from "@automovie/interface";

import { compareCodeUnits } from "../text/compareCodeUnits";
import { materializeCompiledFormation } from "./materializeCompiledFormation";

/**
 * Compile every formation of a production into its compact runtime record.
 *
 * Records are keyed by formation id and inserted in code-unit order of that id,
 * so the inventory and every artifact that serializes it are the same whatever
 * order the designs were read in. Each formation is compiled against the same
 * recipes, radii and terrain, which is what makes a unit compiled here the unit
 * a shot compiled from the same inputs would hold.
 *
 * @evidence requirements/formations/budgets-and-validation.md#formation-determinism Produces the same compiled formation records and order from the same designs regardless of the order they were enumerated in.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-determinism-status-compatibility Orders formation compilation by stable identity so traversal order cannot change the runtime a production holds.
 */
export const materializeCompiledFormationInventory = (props: {
  /** Formation designs keyed by id. */
  formations: ReadonlyMap<string, IAutoMovieFormationDesign>;
  /** Model recipes keyed by id; empty when none are declared. */
  recipes?: ReadonlyMap<string, IAutoMovieModelRecipe>;
  /** Conservative member radius in metres keyed by recipe id. */
  projectionRadii?: ReadonlyMap<string, number>;
  /** World terrain in declared order; empty when the world has none. */
  surfaces?: readonly IAutoMovieWorldSurface[];
}): Readonly<Record<string, IAutoMovieCompiledFormation>> =>
  Object.fromEntries(
    [...props.formations]
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([id, formation]) => [
        id,
        materializeCompiledFormation({
          formation,
          recipes: props.recipes,
          projectionRadii: props.projectionRadii,
          surfaces: props.surfaces,
        }),
      ]),
  );
