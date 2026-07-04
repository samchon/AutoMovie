/**
 * The closed set of **morph-target names** behind {@link IAutoMovieFace} — the
 * flat vocabulary the nested document projects onto.
 *
 * The document is anatomy-shaped (`eyes.size`, `jaw.chin.length`); glTF morph
 * targets are a flat name list. Paired features (eyes, brows, cheeks) carry one
 * target PER SIDE — `R`/`L` suffixes for the subject's right/left — so a shared
 * document value drives both targets and a `left`/`right` override adjusts one:
 * asymmetry is data, not extra geometry. The engine's `flattenFace` performs
 * the projection. The forge bakes one morph target per name into the canonical
 * face template (MediaPipe 468-vertex topology), each turning one nameable
 * trait so identity stays put while a single trait moves. The set is
 * deliberately low-dimensional and human-readable — the same design bet as
 * {@link AutoMovieArkitChannel} for expression, applied to face _shape_.
 *
 * @author Samchon
 */
export type AutoMovieFaceParameterName =
  | "faceWidth"
  | "faceLength"
  | "cheekFullnessR"
  | "cheekFullnessL"
  | "jawWidth"
  | "chinLength"
  | "chinProtrusion"
  | "eyeSizeR"
  | "eyeSizeL"
  | "eyeWidthR"
  | "eyeWidthL"
  | "eyeSpacingR"
  | "eyeSpacingL"
  | "eyeHeightR"
  | "eyeHeightL"
  | "eyeTiltR"
  | "eyeTiltL"
  | "browHeightR"
  | "browHeightL"
  | "noseLength"
  | "noseWidth"
  | "noseProjection"
  | "mouthWidth"
  | "mouthHeight"
  | "lipFullness";
