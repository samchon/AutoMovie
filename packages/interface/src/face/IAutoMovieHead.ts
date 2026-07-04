import { automovieFaceWeight } from "./AutomovieFaceWeight";

/**
 * Cranium and overall head proportion ??the frame the features sit in.
 *
 * @author Samchon
 */
export interface IautomovieHeadShape {
  /** Lateral width of the whole face: `+` wider, `-` narrower. */
  width?: automovieFaceWeight;
  /** Vertical stretch about the eye line: `+` longer, `-` shorter/rounder. */
  length?: automovieFaceWeight;
  /** Toward an oval outline (`+`) vs a squarer one (`-`). */
  oval?: automovieFaceWeight;
  /** Toward a round outline (`+`) vs a rectangular one (`-`). */
  round?: automovieFaceWeight;
  /** Forehead front slope: `+` forward/upright, `-` receding. */
  foreheadSlope?: automovieFaceWeight;
  /** Forehead vertical height: `+` taller (childlike), `-` shorter. */
  foreheadHeight?: automovieFaceWeight;
  /** Forehead/cranial bossing (Nubian curvature). */
  foreheadBulge?: automovieFaceWeight;
  /** Temple width at the side of the forehead. */
  templeWidth?: automovieFaceWeight;
  /** Occiput (back-of-skull) depth: `+` more projection in profile. */
  occiputDepth?: automovieFaceWeight;
}

/** Eyebrows. @author Samchon */
export interface IautomovieHeadBrow {
  /** Vertical brow position: `+` higher (feminine arch), `-` lower. */
  height?: automovieFaceWeight;
  /** Brow tilt: `+` arched up, `-` angled down. */
  angle?: automovieFaceWeight;
}

/**
 * Eyes ??symmetric shared controls (asymmetry is a future global axis). The
 * `epicanthus`/`fold` cues are the East-Asian-defining controls.
 *
 * @author Samchon
 */
export interface IautomovieHeadEyes {
  /** Overall eye size relative to the face: `+` larger (feminine/young). */
  size?: automovieFaceWeight;
  /** Lid aperture openness: `+` more open, `-` narrower. */
  openness?: automovieFaceWeight;
  /** Inter-eye spacing: `+` wider-set (cute/neoteny), `-` closer. */
  spacing?: automovieFaceWeight;
  /** Outer-canthus tilt: `+` up (youthful), `-` down. */
  tilt?: automovieFaceWeight;
  /** Eyeball protrusion in the socket: `+` more prominent, `-` deeper-set. */
  depth?: automovieFaceWeight;
  /** Epicanthic fold at the inner corner: `+` more (East-Asian), `-` open. */
  epicanthus?: automovieFaceWeight;
  /** Upper-lid fold: `+` hooded/mono-lid, `-` deeper double-lid crease. */
  fold?: automovieFaceWeight;
}

/**
 * Nose. `bridge` is the East-Asian-defining radix-height control. @author
 * Samchon
 */
export interface IautomovieHeadNose {
  /** Alar/overall width: `+` wider, `-` narrower. */
  width?: automovieFaceWeight;
  /** Length down the face: `+` longer, `-` shorter. */
  length?: automovieFaceWeight;
  /** Forward projection of the whole nose. */
  projection?: automovieFaceWeight;
  /** Dorsal hump: `+` convex/humped, `-` scooped. */
  hump?: automovieFaceWeight;
  /** Tip vertical angle: `+` upturned, `-` drooping. */
  tipAngle?: automovieFaceWeight;
  /** Nostril width. */
  nostrilWidth?: automovieFaceWeight;
  /** Nasal base height (sub-nasal). */
  baseHeight?: automovieFaceWeight;
  /** Bridge/radix height: `+` higher straight bridge, `-` flatter (East-Asian). */
  bridge?: automovieFaceWeight;
}

/** Mouth and lips. @author Samchon */
export interface IautomovieHeadMouth {
  /** Mouth width: `+` wider, `-` narrower. */
  width?: automovieFaceWeight;
  /** Lip fullness (both lips): `+` fuller (feminine), `-` thinner. */
  lipFullness?: automovieFaceWeight;
  /** Upper-lip vermilion height. */
  upperLipHeight?: automovieFaceWeight;
  /** Lower-lip vermilion height. */
  lowerLipHeight?: automovieFaceWeight;
  /** Cupid's-bow definition. */
  cupidsBow?: automovieFaceWeight;
  /** Philtrum volume. */
  philtrum?: automovieFaceWeight;
  /** Vertical mouth position: `+` higher, `-` lower. */
  height?: automovieFaceWeight;
  /** Resting corner lift (slight smile): `+` up, `-` down. */
  smile?: automovieFaceWeight;
}

/** Cheeks and cheekbones. @author Samchon */
export interface IautomovieHeadCheek {
  /** Soft cheek fullness: `+` fuller (youthful), `-` gaunt. */
  fullness?: automovieFaceWeight;
  /** Malar/cheekbone prominence: `+` higher/sharper (mature beauty). */
  bones?: automovieFaceWeight;
}

/** Jaw and chin. @author Samchon */
export interface IautomovieHeadJaw {
  /** Gonial/jaw width: `+` wider/squarer, `-` softer/tapered (feminine). */
  width?: automovieFaceWeight;
  /** Jaw drop / lower-face length at the angle. */
  drop?: automovieFaceWeight;
  /** Chin vertical length: `+` longer, `-` shorter (feminine/childlike). */
  chinLength?: automovieFaceWeight;
  /** Chin width: `+` broader, `-` narrower/pointed. */
  chinWidth?: automovieFaceWeight;
  /** Chin forward projection: `+` prominent, `-` recessive (East-Asian). */
  chinProjection?: automovieFaceWeight;
}

/**
 * A full-head shape specification for the parametric head built on the clean
 * MakeHuman-derived base ??the document the head editor's tool calling emits
 * and the engine projects (via `flattenHead`) onto
 * {@link automovieHeadParameterName} morph weights the forge `morphHead`
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
export interface IautomovieHead {
  /** Cranium and overall proportion. */
  shape?: IautomovieHeadShape;
  /** Eyebrows. */
  brow?: IautomovieHeadBrow;
  /** Eyes (incl. epicanthus / eyelid fold). */
  eyes?: IautomovieHeadEyes;
  /** Nose (incl. bridge height). */
  nose?: IautomovieHeadNose;
  /** Mouth and lips. */
  mouth?: IautomovieHeadMouth;
  /** Cheeks and cheekbones. */
  cheek?: IautomovieHeadCheek;
  /** Jaw and chin. */
  jaw?: IautomovieHeadJaw;
}
