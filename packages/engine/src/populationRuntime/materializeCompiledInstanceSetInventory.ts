import {
  IAutoMovieCompiledInstanceSet,
  IAutoMovieModelRecipe,
  IAutoMovieWorldDesign,
} from "@automovie/interface";

import { compareCodeUnits } from "../text/compareCodeUnits";
import { materializeCompiledInstanceSet } from "./materializeCompiledInstanceSet";

/**
 * Compile every instance set a world declares into its compact runtime record.
 *
 * Records are keyed by set id and inserted in code-unit order of that id, so
 * the inventory is the same whatever order the world lists its sets in. A
 * world that declares no instance sets compiles to an empty inventory.
 *
 * @evidence requirements/formations/budgets-and-validation.md#formation-determinism Produces the same compiled instance-set records and order from the same world regardless of the order its sets are declared in.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-determinism-status-compatibility Orders instance-set compilation by stable identity so declaration order cannot change the runtime a production holds.
 */
export const materializeCompiledInstanceSetInventory = (props: {
  /** World whose instance sets and routes are compiled. */
  world: Pick<IAutoMovieWorldDesign, "instanceSets" | "routes">;
  /** Model recipes keyed by id; empty when none are declared. */
  recipes?: ReadonlyMap<string, IAutoMovieModelRecipe>;
  /** Conservative member radius in metres keyed by recipe id. */
  projectionRadii?: ReadonlyMap<string, number>;
}): Readonly<Record<string, IAutoMovieCompiledInstanceSet>> =>
  Object.fromEntries(
    [...(props.world.instanceSets ?? [])]
      .sort((left, right) => compareCodeUnits(left.id, right.id))
      .map((instanceSet) => [
        instanceSet.id,
        materializeCompiledInstanceSet({
          instanceSet,
          world: props.world,
          recipes: props.recipes,
          projectionRadii: props.projectionRadii,
        }),
      ]),
  );
