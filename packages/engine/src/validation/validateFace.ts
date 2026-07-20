import { IAutoMovieFace, IAutoMovieValidation } from "@automovie/interface";

import { flattenFace } from "../face/flattenFace";
import { ViolationCollector } from "./violation";

/**
 * Face parameter weights live in `[-FACE_PARAMETER_LIMIT,
 * +FACE_PARAMETER_LIMIT]`.
 */
export const FACE_PARAMETER_LIMIT = 2;

/**
 * Validate an {@link IAutoMovieFace}: Tier-1 range checks the rough types
 * intentionally do not encode.
 *
 * The document is a nested object of optional trait fields, so the field
 * _names_ are already constrained by the type itself (and duplicates are
 * impossible by construction); what remains at runtime is the magnitudes: every
 * present leaf weight must sit in `[-2, 2]`, signed, unlike expression's `[0,
 * 1]`, because face edits go both ways. Violations are reported at the leaf's
 * document path (`….jaw.chin.length`), through the same {@link flattenFace}
 * mapping `morphFace` applies.
 *
 * @author Samchon
 */
export const validateFace = (props: {
  face: IAutoMovieFace;
  path?: string;
  collector?: ViolationCollector;
}): ViolationCollector => {
  const path = props.path ?? "$input";
  const collector = props.collector ?? new ViolationCollector();

  for (const trait of flattenFace(props.face))
    collector.range(
      `${path}.${trait.path}`,
      trait.weight,
      -FACE_PARAMETER_LIMIT,
      FACE_PARAMETER_LIMIT,
      "weight",
    );

  return collector;
};

/** Convenience wrapper returning a finished {@link IAutoMovieValidation}. */
export const validateFaceResult = (
  face: IAutoMovieFace,
): IAutoMovieValidation => validateFace({ face }).toValidation();
