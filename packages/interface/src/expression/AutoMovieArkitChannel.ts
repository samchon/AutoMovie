/**
 * The closed set of **ARKit 52 facial blendshape** channels.
 *
 * ARKit's 52 coefficients are the de-facto industry standard for facial
 * expression: Apple face tracking, MetaHuman, Ready Player Me, and NVIDIA
 * Audio2Face all target them, each in `[0, 1]`. For automovie this is the ideal
 * structured-output target ??a fixed, named, normalized, _low_-dimensional
 * vector. The model picks channels from this closed menu (so an invalid channel
 * name is impossible) and assigns weights documented to `[0, 1]` (the engine
 * clamps/validates the magnitude).
 *
 * Naming follows Apple's `ARFaceAnchor.BlendShapeLocation` lowerCamelCase keys
 * verbatim, so a automovie expression maps 1:1 onto any ARKit-compatible
 * runtime.
 *
 * Reference: Apple ARKit `ARFaceAnchor.blendShapes`
 * (https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapes).
 *
 * @author Samchon
 */
export type automovieArkitChannel =
  // ?? eyes (14) ??
  | "eyeBlinkLeft"
  | "eyeLookDownLeft"
  | "eyeLookInLeft"
  | "eyeLookOutLeft"
  | "eyeLookUpLeft"
  | "eyeSquintLeft"
  | "eyeWideLeft"
  | "eyeBlinkRight"
  | "eyeLookDownRight"
  | "eyeLookInRight"
  | "eyeLookOutRight"
  | "eyeLookUpRight"
  | "eyeSquintRight"
  | "eyeWideRight"
  // ?? jaw (4) ??
  | "jawForward"
  | "jawLeft"
  | "jawRight"
  | "jawOpen"
  // ?? mouth (23) ??
  | "mouthClose"
  | "mouthFunnel"
  | "mouthPucker"
  | "mouthLeft"
  | "mouthRight"
  | "mouthSmileLeft"
  | "mouthSmileRight"
  | "mouthFrownLeft"
  | "mouthFrownRight"
  | "mouthDimpleLeft"
  | "mouthDimpleRight"
  | "mouthStretchLeft"
  | "mouthStretchRight"
  | "mouthRollLower"
  | "mouthRollUpper"
  | "mouthShrugLower"
  | "mouthShrugUpper"
  | "mouthPressLeft"
  | "mouthPressRight"
  | "mouthLowerDownLeft"
  | "mouthLowerDownRight"
  | "mouthUpperUpLeft"
  | "mouthUpperUpRight"
  // ?? brows (5) ??
  | "browDownLeft"
  | "browDownRight"
  | "browInnerUp"
  | "browOuterUpLeft"
  | "browOuterUpRight"
  // ?? cheeks (3) ??
  | "cheekPuff"
  | "cheekSquintLeft"
  | "cheekSquintRight"
  // ?? nose (2) ??
  | "noseSneerLeft"
  | "noseSneerRight"
  // ?? tongue (1) ??
  | "tongueOut";
