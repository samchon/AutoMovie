import { AutoMovieFaceWeight } from "./AutoMovieFaceWeight";

/**
 * Cranium and overall head proportion: the frame the features sit in.
 *
 * @author Samchon
 */
export interface IAutoMovieHeadShape {
  /** Lateral width of the whole face: `+` wider, `-` narrower. */
  width?: AutoMovieFaceWeight;
  /** Vertical stretch about the eye line: `+` longer, `-` shorter/rounder. */
  length?: AutoMovieFaceWeight;
  /** Toward an oval outline (`+`) vs a squarer one (`-`). */
  oval?: AutoMovieFaceWeight;
  /** Toward a round outline (`+`) vs a rectangular one (`-`). */
  round?: AutoMovieFaceWeight;
  /** Forehead front slope: `+` forward/upright, `-` receding. */
  foreheadSlope?: AutoMovieFaceWeight;
  /** Forehead vertical height: `+` taller (childlike), `-` shorter. */
  foreheadHeight?: AutoMovieFaceWeight;
  /** Forehead/cranial bossing (Nubian curvature). */
  foreheadBulge?: AutoMovieFaceWeight;
  /** Temple width at the side of the forehead. */
  templeWidth?: AutoMovieFaceWeight;
  /** Occiput (back-of-skull) depth: `+` more projection in profile. */
  occiputDepth?: AutoMovieFaceWeight;
}

/** Eyebrows. @author Samchon */
export interface IAutoMovieHeadBrow {
  /** Vertical brow position: `+` higher (feminine arch), `-` lower. */
  height?: AutoMovieFaceWeight;
  /** Brow tilt: `+` arched up, `-` angled down. */
  angle?: AutoMovieFaceWeight;
}

/**
 * Eyes: symmetric shared controls (asymmetry is a future global axis). The
 * `epicanthus`/`fold` cues are the East-Asian-defining controls.
 *
 * @author Samchon
 */
export interface IAutoMovieHeadEyes {
  /** Overall eye size relative to the face: `+` larger (feminine/young). */
  size?: AutoMovieFaceWeight;
  /** Lid aperture openness: `+` more open, `-` narrower. */
  openness?: AutoMovieFaceWeight;
  /** Inter-eye spacing: `+` wider-set (cute/neoteny), `-` closer. */
  spacing?: AutoMovieFaceWeight;
  /** Outer-canthus tilt: `+` up (youthful), `-` down. */
  tilt?: AutoMovieFaceWeight;
  /** Eyeball protrusion in the socket: `+` more prominent, `-` deeper-set. */
  depth?: AutoMovieFaceWeight;
  /** Epicanthic fold at the inner corner: `+` more (East-Asian), `-` open. */
  epicanthus?: AutoMovieFaceWeight;
  /** Upper-lid fold: `+` hooded/mono-lid, `-` deeper double-lid crease. */
  fold?: AutoMovieFaceWeight;
}

/**
 * Nose. `bridge` is the East-Asian-defining radix-height control. @author
 * Samchon
 */
export interface IAutoMovieHeadNose {
  /** Alar/overall width: `+` wider, `-` narrower. */
  width?: AutoMovieFaceWeight;
  /** Length down the face: `+` longer, `-` shorter. */
  length?: AutoMovieFaceWeight;
  /** Forward projection of the whole nose. */
  projection?: AutoMovieFaceWeight;
  /** Dorsal hump: `+` convex/humped, `-` scooped. */
  hump?: AutoMovieFaceWeight;
  /** Tip vertical angle: `+` upturned, `-` drooping. */
  tipAngle?: AutoMovieFaceWeight;
  /** Nostril width. */
  nostrilWidth?: AutoMovieFaceWeight;
  /** Nasal base height (sub-nasal). */
  baseHeight?: AutoMovieFaceWeight;
  /** Bridge/radix height: `+` higher straight bridge, `-` flatter (East-Asian). */
  bridge?: AutoMovieFaceWeight;
}

/** Mouth and lips. @author Samchon */
export interface IAutoMovieHeadMouth {
  /** Mouth width: `+` wider, `-` narrower. */
  width?: AutoMovieFaceWeight;
  /** Lip fullness (both lips): `+` fuller (feminine), `-` thinner. */
  lipFullness?: AutoMovieFaceWeight;
  /** Upper-lip vermilion height. */
  upperLipHeight?: AutoMovieFaceWeight;
  /** Lower-lip vermilion height. */
  lowerLipHeight?: AutoMovieFaceWeight;
  /** Cupid's-bow definition. */
  cupidsBow?: AutoMovieFaceWeight;
  /** Philtrum volume. */
  philtrum?: AutoMovieFaceWeight;
  /** Vertical mouth position: `+` higher, `-` lower. */
  height?: AutoMovieFaceWeight;
  /** Resting corner lift (slight smile): `+` up, `-` down. */
  smile?: AutoMovieFaceWeight;
}

/** Cheeks and cheekbones. @author Samchon */
export interface IAutoMovieHeadCheek {
  /** Soft cheek fullness: `+` fuller (youthful), `-` gaunt. */
  fullness?: AutoMovieFaceWeight;
  /** Malar/cheekbone prominence: `+` higher/sharper (mature beauty). */
  bones?: AutoMovieFaceWeight;
}

/** Jaw and chin. @author Samchon */
export interface IAutoMovieHeadJaw {
  /** Gonial/jaw width: `+` wider/squarer, `-` softer/tapered (feminine). */
  width?: AutoMovieFaceWeight;
  /** Jaw drop / lower-face length at the angle. */
  drop?: AutoMovieFaceWeight;
  /** Chin vertical length: `+` longer, `-` shorter (feminine/childlike). */
  chinLength?: AutoMovieFaceWeight;
  /** Chin width: `+` broader, `-` narrower/pointed. */
  chinWidth?: AutoMovieFaceWeight;
  /** Chin forward projection: `+` prominent, `-` recessive (East-Asian). */
  chinProjection?: AutoMovieFaceWeight;
}

/**
 * A full-head shape specification for the parametric head built on the clean
 * MakeHuman-derived base: the document the head editor's tool calling emits
 * and the engine projects (via `flattenHead`) onto
 * {@link AutoMovieHeadParameterName} morph weights the forge `morphHead`
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
export interface IAutoMovieHead {
  /** Cranium and overall proportion. */
  shape?: IAutoMovieHeadShape;
  /** Eyebrows. */
  brow?: IAutoMovieHeadBrow;
  /** Eyes (incl. epicanthus / eyelid fold). */
  eyes?: IAutoMovieHeadEyes;
  /** Nose (incl. bridge height). */
  nose?: IAutoMovieHeadNose;
  /** Mouth and lips. */
  mouth?: IAutoMovieHeadMouth;
  /** Cheeks and cheekbones. */
  cheek?: IAutoMovieHeadCheek;
  /** Jaw and chin. */
  jaw?: IAutoMovieHeadJaw;
}
