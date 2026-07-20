import { AutoMovieFaceWeight } from "./AutoMovieFaceWeight";
import { IAutoMovieFaceEye } from "./IAutoMovieFaceEye";

/**
 * The eye PAIR of an {@link IAutoMovieFace}.
 *
 * **Side rule (read this first):** when only ONE of `left`/`right` is defined,
 * it applies to BOTH eyes (the symmetric shorthand: most faces need nothing
 * more). When BOTH are defined, each side stands alone and applies only to its
 * own eye (uneven eyes). There is no separate "both" field.
 *
 * Pair-level traits (the relation between the two eyes) live here; traits of an
 * eye itself live in {@link IAutoMovieFaceEye}. Sides are the SUBJECT's
 * left/right. The Set/single naming split is deliberate: "EyeSet" vs "Eye"
 * cannot be confused by a tool-calling model the way "Eyes" vs "Eye" can.
 *
 * @author Samchon
 */
export interface IAutoMovieFaceEyeSet {
  /** Distance between the eyes: `+` wide-set, `-` close-set. */
  spacing?: AutoMovieFaceWeight;

  /** The subject's LEFT eye; applies to BOTH eyes when `right` is omitted. */
  left?: IAutoMovieFaceEye;

  /** The subject's RIGHT eye; applies to BOTH eyes when `left` is omitted. */
  right?: IAutoMovieFaceEye;
}
