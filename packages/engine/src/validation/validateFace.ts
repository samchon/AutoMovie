import { IAutoFilmFace, IAutoFilmValidation } from "@autofilm/interface";

import { ViolationCollector } from "./violation";

/**
 * Face parameter weights live in `[-FACE_PARAMETER_LIMIT,
 * +FACE_PARAMETER_LIMIT]`.
 */
export const FACE_PARAMETER_LIMIT = 2;

/**
 * Validate an {@link IAutoFilmFace} — Tier-1 range checks the rough types
 * intentionally do not encode.
 *
 * The document is an object of optional trait fields, so the field _names_ are
 * already constrained by the type itself (and duplicates are impossible by
 * construction); what remains at runtime is the magnitudes: every present
 * weight must sit in `[-2, 2]` — signed, unlike expression's `[0, 1]`, because
 * face edits go both ways.
 *
 * @author Samchon
 */
export const validateFace = (props: {
  face: IAutoFilmFace;
  path?: string;
  collector?: ViolationCollector;
}): ViolationCollector => {
  const path = props.path ?? "$input";
  const collector = props.collector ?? new ViolationCollector();

  for (const [parameter, weight] of Object.entries(props.face))
    collector.range(
      `${path}.${parameter}`,
      weight,
      -FACE_PARAMETER_LIMIT,
      FACE_PARAMETER_LIMIT,
      "weight",
    );

  return collector;
};

/** Convenience wrapper returning a finished {@link IAutoFilmValidation}. */
export const validateFaceResult = (face: IAutoFilmFace): IAutoFilmValidation =>
  validateFace({ face }).toValidation();
