import { IautomovieFaceBrow } from "./IautomovieFaceBrow";

/**
 * The eyebrow PAIR of an {@link IautomovieFace}.
 *
 * **Side rule:** when only ONE of `left`/`right` is defined, it applies to BOTH
 * brows (the symmetric shorthand); when both are defined, each side stands
 * alone (a raised single brow).
 *
 * @author Samchon
 */
export interface IautomovieFaceBrowSet {
  /** The subject's LEFT brow ??applies to BOTH brows when `right` is omitted. */
  left?: IautomovieFaceBrow;

  /** The subject's RIGHT brow ??applies to BOTH brows when `left` is omitted. */
  right?: IautomovieFaceBrow;
}
