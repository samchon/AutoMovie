import { automovieFaceWeight } from "./AutomovieFaceWeight";
import { IautomovieFaceEye } from "./IautomovieFaceEye";

/**
 * The eye PAIR of an {@link IautomovieFace}.
 *
 * **Side rule ??read this first:** when only ONE of `left`/`right` is defined,
 * it applies to BOTH eyes (the symmetric shorthand ??most faces need nothing
 * more). When BOTH are defined, each side stands alone and applies only to its
 * own eye (uneven eyes). There is no separate "both" field.
 *
 * Pair-level traits (the relation between the two eyes) live here; traits of an
 * eye itself live in {@link IautomovieFaceEye}. Sides are the SUBJECT's
 * left/right. The Set/single naming split is deliberate: "EyeSet" vs "Eye"
 * cannot be confused by a tool-calling model the way "Eyes" vs "Eye" can.
 *
 * @author Samchon
 */
export interface IautomovieFaceEyeSet {
  /** Distance between the eyes: `+` wide-set, `-` close-set. */
  spacing?: automovieFaceWeight;

  /** The subject's LEFT eye ??applies to BOTH eyes when `right` is omitted. */
  left?: IautomovieFaceEye;

  /** The subject's RIGHT eye ??applies to BOTH eyes when `left` is omitted. */
  right?: IautomovieFaceEye;
}
