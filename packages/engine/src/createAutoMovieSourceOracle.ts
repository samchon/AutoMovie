import {
  IAutoMovieCompiledFormation,
  IAutoMovieCompiledInstanceSet,
  IAutoMovieSourceOracle,
  IAutoMovieWorldDesign,
} from "@automovie/interface";

import { compiledFormationSlot } from "./populationRuntime/compiledFormationSlot";
import { instanceSlot } from "./populationRuntime/instanceSlot";
import { worldGroundHeight } from "./worldKit";

/**
 * Build the deterministic helpers a shot source reads through its build context.
 *
 * A shot source asks where one member of a formation or instance set stands
 * while the builder is still compiling the shot, so the answer has to be the
 * one the compiled runtime holds. Both slot helpers regenerate from the
 * compiled records the source's context carries, never from the designs beside
 * them: a formation member stands on the terrain snapshot its unit was compiled
 * against, and an instance member selects from the compiled prototype table,
 * which already counts the default once. Distance is Euclidean in metres, and
 * ground height is the first world surface under the point or zero over none.
 *
 * An id with no compiled record refuses with a range error naming it, including
 * an id that only an inherited object property would otherwise answer.
 *
 * @evidence requirements/formations/budgets-and-validation.md#formation-determinism Answers a shot source's one-member formation and instance questions with the identity and transform the compiled runtime regenerates for that slot.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-determinism-status-compatibility Keeps the source-facing member oracle and the full compiled runtime on one regeneration path, so they return the same transform and state.
 */
export const createAutoMovieSourceOracle = (props: {
  /** World whose surfaces answer ground height. */
  world: Pick<IAutoMovieWorldDesign, "surfaces">;
  /** Compiled formation runtimes keyed by formation id. */
  formationRuntime: Readonly<Record<string, IAutoMovieCompiledFormation>>;
  /** Compiled instance-set runtimes keyed by set id. */
  instanceSetRuntime: Readonly<Record<string, IAutoMovieCompiledInstanceSet>>;
}): IAutoMovieSourceOracle => ({
  distance: (left, right) =>
    Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z),
  groundHeight: (point) => worldGroundHeight(props.world.surfaces, point) ?? 0,
  formationSlot: (id, slot) => {
    if (Object.hasOwn(props.formationRuntime, id) === false)
      throw new RangeError(`Formation "${id}" is unavailable.`);
    return compiledFormationSlot(props.formationRuntime[id]!, slot);
  },
  instanceSlot: (id, slot) => {
    if (Object.hasOwn(props.instanceSetRuntime, id) === false)
      throw new RangeError(`Instance set "${id}" is unavailable.`);
    return instanceSlot(props.instanceSetRuntime[id]!, slot);
  },
});
