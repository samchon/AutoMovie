/**
 * The closed set of **morph names** for the parametric head built on the clean
 * MakeHuman-derived base — the flat vocabulary that {@link IAutoMovieHead}
 * projects onto and the forge `morphHead` applies.
 *
 * These are the comprehensive identity/shape controls (not expression): head
 * silhouette and proportion, brow, eyes (incl. the East-Asian epicanthus and
 * eyelid-fold controls), nose (incl. bridge height), mouth/lips, cheek/malar,
 * and jaw/chin. Each name maps to one additive vertex-delta morph; a signed
 * weight deviates from the neutral average (`0`), the sign picking direction.
 *
 * Distinct from {@link AutoMovieFaceParameterName}, which is the legacy
 * MediaPipe-topology vocabulary; this set targets the full-head topology and is
 * the one the head editor exposes.
 *
 * @author Samchon
 */
export type AutoMovieHeadParameterName =
  // head / cranium
  | "faceWidth"
  | "faceLength"
  | "faceOval"
  | "headRound"
  | "foreheadSlope"
  | "foreheadHeight"
  | "foreheadBulge"
  | "templeWidth"
  | "occiputDepth"
  // brow
  | "browHeight"
  | "browAngle"
  // eyes
  | "eyeSize"
  | "eyeHeight"
  | "eyeSpacing"
  | "eyeAngle"
  | "eyeDepth"
  | "epicanthus"
  | "eyeFold"
  // nose
  | "noseWidth"
  | "noseLength"
  | "noseProject"
  | "noseHump"
  | "nosePoint"
  | "nostrilWidth"
  | "noseBaseH"
  | "noseBridge"
  // mouth
  | "mouthWidth"
  | "lipFull"
  | "upperLipH"
  | "lowerLipH"
  | "cupidsBow"
  | "philtrum"
  | "mouthHeight"
  | "mouthSmile"
  // cheek
  | "cheekFull"
  | "cheekBones"
  // jaw / chin
  | "jawWidth"
  | "jawDrop"
  | "chinLength"
  | "chinWidth"
  | "chinProject";
