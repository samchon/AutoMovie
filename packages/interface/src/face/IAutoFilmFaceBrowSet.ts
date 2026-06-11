import { IAutoFilmFaceBrow } from "./IAutoFilmFaceBrow";

/**
 * The eyebrow PAIR of an {@link IAutoFilmFace}.
 *
 * **Side rule:** when only ONE of `left`/`right` is defined, it applies to BOTH
 * brows (the symmetric shorthand); when both are defined, each side stands
 * alone (a raised single brow).
 *
 * @author Samchon
 */
export interface IAutoFilmFaceBrowSet {
  /** The subject's LEFT brow — applies to BOTH brows when `right` is omitted. */
  left?: IAutoFilmFaceBrow;

  /** The subject's RIGHT brow — applies to BOTH brows when `left` is omitted. */
  right?: IAutoFilmFaceBrow;
}
