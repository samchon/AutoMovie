import { AutoFilmFaceParameterName } from "./AutoFilmFaceParameterName";

/**
 * One face-shape parameter set to a weight — the face editor's control atom.
 *
 * The pair of a closed parameter name and a `[-2, 2]` weight mirrors
 * {@link IAutoFilmBlendshapeChannel} (expression's atom): a named, bounded,
 * low-dimensional handle an LLM can emit without ever touching vertices. Unlike
 * expression weights, face weights are signed — `eyeSize: -1` shrinks exactly
 * as far as `+1` grows.
 *
 * @author Samchon
 */
export interface IAutoFilmFaceParameter {
  /** Which face-shape trait — from the closed parameter menu. */
  parameter: AutoFilmFaceParameterName;

  /**
   * Morph weight, `[-2, 2]`. `0` = neutral, `±1` = one nominal trait step,
   * beyond `±1` exaggerates toward caricature.
   */
  weight: number;
}
