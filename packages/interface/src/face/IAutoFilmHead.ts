import { AutoFilmFaceWeight } from "./AutoFilmFaceWeight";

/**
 * Cranium and overall head proportion — the frame the features sit in.
 *
 * @author Samchon
 */
export interface IAutoFilmHeadShape {
  /** Lateral width of the whole face: `+` wider, `-` narrower. */
  width?: AutoFilmFaceWeight;
  /** Vertical stretch about the eye line: `+` longer, `-` shorter/rounder. */
  length?: AutoFilmFaceWeight;
  /** Toward an oval outline (`+`) vs a squarer one (`-`). */
  oval?: AutoFilmFaceWeight;
  /** Toward a round outline (`+`) vs a rectangular one (`-`). */
  round?: AutoFilmFaceWeight;
  /** Forehead front slope: `+` forward/upright, `-` receding. */
  foreheadSlope?: AutoFilmFaceWeight;
  /** Forehead vertical height: `+` taller (childlike), `-` shorter. */
  foreheadHeight?: AutoFilmFaceWeight;
  /** Forehead/cranial bossing (Nubian curvature). */
  foreheadBulge?: AutoFilmFaceWeight;
  /** Temple width at the side of the forehead. */
  templeWidth?: AutoFilmFaceWeight;
  /** Occiput (back-of-skull) depth: `+` more projection in profile. */
  occiputDepth?: AutoFilmFaceWeight;
}

/** Eyebrows. @author Samchon */
export interface IAutoFilmHeadBrow {
  /** Vertical brow position: `+` higher (feminine arch), `-` lower. */
  height?: AutoFilmFaceWeight;
  /** Brow tilt: `+` arched up, `-` angled down. */
  angle?: AutoFilmFaceWeight;
}

/**
 * Eyes — symmetric shared controls (asymmetry is a future global axis). The
 * `epicanthus`/`fold` cues are the East-Asian-defining controls.
 *
 * @author Samchon
 */
export interface IAutoFilmHeadEyes {
  /** Overall eye size relative to the face: `+` larger (feminine/young). */
  size?: AutoFilmFaceWeight;
  /** Lid aperture openness: `+` more open, `-` narrower. */
  openness?: AutoFilmFaceWeight;
  /** Inter-eye spacing: `+` wider-set (cute/neoteny), `-` closer. */
  spacing?: AutoFilmFaceWeight;
  /** Outer-canthus tilt: `+` up (youthful), `-` down. */
  tilt?: AutoFilmFaceWeight;
  /** Eyeball protrusion in the socket: `+` more prominent, `-` deeper-set. */
  depth?: AutoFilmFaceWeight;
  /** Epicanthic fold at the inner corner: `+` more (East-Asian), `-` open. */
  epicanthus?: AutoFilmFaceWeight;
  /** Upper-lid fold: `+` hooded/mono-lid, `-` deeper double-lid crease. */
  fold?: AutoFilmFaceWeight;
}

/**
 * Nose. `bridge` is the East-Asian-defining radix-height control. @author
 * Samchon
 */
export interface IAutoFilmHeadNose {
  /** Alar/overall width: `+` wider, `-` narrower. */
  width?: AutoFilmFaceWeight;
  /** Length down the face: `+` longer, `-` shorter. */
  length?: AutoFilmFaceWeight;
  /** Forward projection of the whole nose. */
  projection?: AutoFilmFaceWeight;
  /** Dorsal hump: `+` convex/humped, `-` scooped. */
  hump?: AutoFilmFaceWeight;
  /** Tip vertical angle: `+` upturned, `-` drooping. */
  tipAngle?: AutoFilmFaceWeight;
  /** Nostril width. */
  nostrilWidth?: AutoFilmFaceWeight;
  /** Nasal base height (sub-nasal). */
  baseHeight?: AutoFilmFaceWeight;
  /** Bridge/radix height: `+` higher straight bridge, `-` flatter (East-Asian). */
  bridge?: AutoFilmFaceWeight;
}

/** Mouth and lips. @author Samchon */
export interface IAutoFilmHeadMouth {
  /** Mouth width: `+` wider, `-` narrower. */
  width?: AutoFilmFaceWeight;
  /** Lip fullness (both lips): `+` fuller (feminine), `-` thinner. */
  lipFullness?: AutoFilmFaceWeight;
  /** Upper-lip vermilion height. */
  upperLipHeight?: AutoFilmFaceWeight;
  /** Lower-lip vermilion height. */
  lowerLipHeight?: AutoFilmFaceWeight;
  /** Cupid's-bow definition. */
  cupidsBow?: AutoFilmFaceWeight;
  /** Philtrum volume. */
  philtrum?: AutoFilmFaceWeight;
  /** Vertical mouth position: `+` higher, `-` lower. */
  height?: AutoFilmFaceWeight;
  /** Resting corner lift (slight smile): `+` up, `-` down. */
  smile?: AutoFilmFaceWeight;
}

/** Cheeks and cheekbones. @author Samchon */
export interface IAutoFilmHeadCheek {
  /** Soft cheek fullness: `+` fuller (youthful), `-` gaunt. */
  fullness?: AutoFilmFaceWeight;
  /** Malar/cheekbone prominence: `+` higher/sharper (mature beauty). */
  bones?: AutoFilmFaceWeight;
}

/** Jaw and chin. @author Samchon */
export interface IAutoFilmHeadJaw {
  /** Gonial/jaw width: `+` wider/squarer, `-` softer/tapered (feminine). */
  width?: AutoFilmFaceWeight;
  /** Jaw drop / lower-face length at the angle. */
  drop?: AutoFilmFaceWeight;
  /** Chin vertical length: `+` longer, `-` shorter (feminine/childlike). */
  chinLength?: AutoFilmFaceWeight;
  /** Chin width: `+` broader, `-` narrower/pointed. */
  chinWidth?: AutoFilmFaceWeight;
  /** Chin forward projection: `+` prominent, `-` recessive (East-Asian). */
  chinProjection?: AutoFilmFaceWeight;
}

/**
 * A full-head shape specification for the parametric head built on the clean
 * MakeHuman-derived base — the document the head editor's tool calling emits
 * and the engine projects (via `flattenHead`) onto
 * {@link AutoFilmHeadParameterName} morph weights the forge `morphHead`
 * applies.
 *
 * Anatomy-grouped so an LLM reads it the way a person reads a face; every leaf
 * is a signed weight in `[-2, 2]` (`0` = the neutral average). Omitted fields
 * and groups mean neutral. This is the comprehensive identity/shape spec (cute
 * / beauty / plain archetypes and East-Asian cues are all reachable);
 * expression is out of scope.
 *
 * @author Samchon
 */
export interface IAutoFilmHead {
  /** Cranium and overall proportion. */
  shape?: IAutoFilmHeadShape;
  /** Eyebrows. */
  brow?: IAutoFilmHeadBrow;
  /** Eyes (incl. epicanthus / eyelid fold). */
  eyes?: IAutoFilmHeadEyes;
  /** Nose (incl. bridge height). */
  nose?: IAutoFilmHeadNose;
  /** Mouth and lips. */
  mouth?: IAutoFilmHeadMouth;
  /** Cheeks and cheekbones. */
  cheek?: IAutoFilmHeadCheek;
  /** Jaw and chin. */
  jaw?: IAutoFilmHeadJaw;
}
