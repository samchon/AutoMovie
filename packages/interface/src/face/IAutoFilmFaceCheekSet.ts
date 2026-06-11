import { IAutoFilmFaceCheek } from "./IAutoFilmFaceCheek";

/**
 * The cheek PAIR of an {@link IAutoFilmFace}.
 *
 * **Side rule:** when only ONE of `left`/`right` is defined, it applies to BOTH
 * cheeks (the symmetric shorthand); when both are defined, each side stands
 * alone.
 *
 * @author Samchon
 */
export interface IAutoFilmFaceCheekSet {
  /** The subject's LEFT cheek — applies to BOTH cheeks when `right` is omitted. */
  left?: IAutoFilmFaceCheek;

  /** The subject's RIGHT cheek — applies to BOTH cheeks when `left` is omitted. */
  right?: IAutoFilmFaceCheek;
}
