import { IautomovieGaitLimb } from "./IautomovieGaitLimb";

/**
 * A **declarative gait**: a creature's characteristic locomotion expressed as
 * data, not hand-keyed frames. The same engine synthesiser turns this into a
 * human walk, a horse's lateral-sequence walk, a cat's stalk, or a gallop ?? * differing only in the per-limb **phase offsets**, **duty factor**, and
 * **amplitude**. This is the concrete answer to "every object moves
 * differently": one parameter set per gait, the engine fattening it into
 * per-frame motion ({@link IautomovieMotion}). A profile carries a set of these.
 *
 * @author Samchon
 */
export interface IautomovieGait {
  /** Stable name (`"walk"`, `"trot"`, `"gallop"`, `"stalk"`). */
  name: string;

  /** Stride period ??one full cycle ??in seconds. */
  period: number;

  /** Each limb's contribution to the cycle. */
  limbs: IautomovieGaitLimb[];
}
