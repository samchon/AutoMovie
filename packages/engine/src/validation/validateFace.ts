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
 * Parameter _names_ are already constrained by the closed
 * `AutoFilmFaceParameterName` union, so what remains at runtime is the
 * magnitudes and the shape of the list: every weight must sit in `[-2, 2]`
 * (signed, unlike expression's `[0, 1]` — face edits go both ways), and no
 * parameter may be set twice.
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

  const seen = new Set<string>();
  props.face.parameters.forEach((p, i) => {
    const pp = `${path}.parameters[${i}]`;
    collector.range(
      `${pp}.weight`,
      p.weight,
      -FACE_PARAMETER_LIMIT,
      FACE_PARAMETER_LIMIT,
      "weight",
    );
    if (seen.has(p.parameter))
      collector.push(
        "type",
        `${pp}.parameter`,
        `face parameter "${p.parameter}" is set more than once`,
        p.parameter,
      );
    seen.add(p.parameter);
  });

  return collector;
};

/** Convenience wrapper returning a finished {@link IAutoFilmValidation}. */
export const validateFaceResult = (face: IAutoFilmFace): IAutoFilmValidation =>
  validateFace({ face }).toValidation();
