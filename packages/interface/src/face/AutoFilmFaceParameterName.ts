/**
 * The closed set of **morph-target names** behind {@link IAutoFilmFace} — the
 * flat vocabulary the nested document projects onto.
 *
 * The document is anatomy-shaped (`eyes.size`, `jaw.chin.length`); glTF morph
 * targets are a flat name list. Each leaf trait of the document corresponds to
 * exactly one name here (`eyes.size` → `eyeSize`), and the engine's
 * `flattenFace` performs that projection. The forge bakes one morph target per
 * name into the canonical face template (MediaPipe 468-vertex topology), each
 * turning one nameable trait so identity stays put while a single trait moves.
 * The set is deliberately low-dimensional and human-readable — the same design
 * bet as {@link AutoFilmArkitChannel} for expression, applied to face _shape_.
 *
 * @author Samchon
 */
export type AutoFilmFaceParameterName =
  | "faceWidth"
  | "faceLength"
  | "cheekFullness"
  | "jawWidth"
  | "chinLength"
  | "chinProtrusion"
  | "eyeSize"
  | "eyeWidth"
  | "eyeSpacing"
  | "eyeHeight"
  | "eyeTilt"
  | "browHeight"
  | "noseLength"
  | "noseWidth"
  | "noseProjection"
  | "mouthWidth"
  | "mouthHeight"
  | "lipFullness";
