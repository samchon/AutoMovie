import { AutoMovieFaceWeight } from "./AutoMovieFaceWeight";

/**
 * Cranium and overall head proportion: the frame the features sit in.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieHeadShape` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieHeadShape` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieHeadShape {
  /**
   * Lateral width of the whole face: `+` wider, `-` narrower.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `width` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `width` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  width?: AutoMovieFaceWeight;
  /**
   * Vertical stretch about the eye line: `+` longer, `-` shorter/rounder.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `length` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `length` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  length?: AutoMovieFaceWeight;
  /**
   * Toward an oval outline (`+`) vs a squarer one (`-`).
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `oval` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `oval` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  oval?: AutoMovieFaceWeight;
  /**
   * Toward a round outline (`+`) vs a rectangular one (`-`).
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `round` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `round` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  round?: AutoMovieFaceWeight;
  /**
   * Forehead front slope: `+` forward/upright, `-` receding.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `foreheadSlope` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `foreheadSlope` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  foreheadSlope?: AutoMovieFaceWeight;
  /**
   * Forehead vertical height: `+` taller (childlike), `-` shorter.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `foreheadHeight` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `foreheadHeight` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  foreheadHeight?: AutoMovieFaceWeight;
  /**
   * Forehead/cranial bossing (Nubian curvature).
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `foreheadBulge` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `foreheadBulge` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  foreheadBulge?: AutoMovieFaceWeight;
  /**
   * Temple width at the side of the forehead.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `templeWidth` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `templeWidth` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  templeWidth?: AutoMovieFaceWeight;
  /**
   * Occiput (back-of-skull) depth: `+` more projection in profile.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `occiputDepth` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `occiputDepth` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  occiputDepth?: AutoMovieFaceWeight;
}

/**
 * Eyebrows.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieHeadBrow` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieHeadBrow` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieHeadBrow {
  /**
   * Vertical brow position: `+` higher (feminine arch), `-` lower.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `height` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `height` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  height?: AutoMovieFaceWeight;
  /**
   * Brow tilt: `+` arched up, `-` angled down.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `angle` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `angle` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  angle?: AutoMovieFaceWeight;
}

/**
 * Eyes: symmetric shared controls (asymmetry is a future global axis). The
 * `epicanthus`/`fold` cues are the East-Asian-defining controls.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieHeadEyes` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieHeadEyes` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieHeadEyes {
  /**
   * Overall eye size relative to the face: `+` larger (feminine/young).
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `size` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `size` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  size?: AutoMovieFaceWeight;
  /**
   * Lid aperture openness: `+` more open, `-` narrower.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `openness` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `openness` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  openness?: AutoMovieFaceWeight;
  /**
   * Inter-eye spacing: `+` wider-set (cute/neoteny), `-` closer.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `spacing` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `spacing` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  spacing?: AutoMovieFaceWeight;
  /**
   * Outer-canthus tilt: `+` up (youthful), `-` down.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `tilt` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `tilt` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  tilt?: AutoMovieFaceWeight;
  /**
   * Eyeball protrusion in the socket: `+` more prominent, `-` deeper-set.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `depth` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `depth` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  depth?: AutoMovieFaceWeight;
  /**
   * Epicanthic fold at the inner corner: `+` more (East-Asian), `-` open.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `epicanthus` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `epicanthus` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  epicanthus?: AutoMovieFaceWeight;
  /**
   * Upper-lid fold: `+` hooded/mono-lid, `-` deeper double-lid crease.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `fold` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `fold` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  fold?: AutoMovieFaceWeight;
}

/**
 * Nose. `bridge` is the East-Asian-defining radix-height control.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieHeadNose` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieHeadNose` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieHeadNose {
  /**
   * Alar/overall width: `+` wider, `-` narrower.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `width` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `width` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  width?: AutoMovieFaceWeight;
  /**
   * Length down the face: `+` longer, `-` shorter.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `length` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `length` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  length?: AutoMovieFaceWeight;
  /**
   * Forward projection of the whole nose.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `projection` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `projection` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  projection?: AutoMovieFaceWeight;
  /**
   * Dorsal hump: `+` convex/humped, `-` scooped.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `hump` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `hump` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  hump?: AutoMovieFaceWeight;
  /**
   * Tip vertical angle: `+` upturned, `-` drooping.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `tipAngle` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `tipAngle` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  tipAngle?: AutoMovieFaceWeight;
  /**
   * Nostril width.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `nostrilWidth` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `nostrilWidth` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  nostrilWidth?: AutoMovieFaceWeight;
  /**
   * Nasal base height (sub-nasal).
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `baseHeight` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `baseHeight` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  baseHeight?: AutoMovieFaceWeight;
  /**
   * Bridge/radix height: `+` higher straight bridge, `-` flatter (East-Asian).
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `bridge` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `bridge` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  bridge?: AutoMovieFaceWeight;
}

/**
 * Mouth and lips.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieHeadMouth` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieHeadMouth` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieHeadMouth {
  /**
   * Mouth width: `+` wider, `-` narrower.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `width` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `width` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  width?: AutoMovieFaceWeight;
  /**
   * Lip fullness (both lips): `+` fuller (feminine), `-` thinner.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `lipFullness` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `lipFullness` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  lipFullness?: AutoMovieFaceWeight;
  /**
   * Upper-lip vermilion height.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `upperLipHeight` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `upperLipHeight` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  upperLipHeight?: AutoMovieFaceWeight;
  /**
   * Lower-lip vermilion height.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `lowerLipHeight` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `lowerLipHeight` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  lowerLipHeight?: AutoMovieFaceWeight;
  /**
   * Cupid's-bow definition.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `cupidsBow` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `cupidsBow` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  cupidsBow?: AutoMovieFaceWeight;
  /**
   * Philtrum volume.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `philtrum` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `philtrum` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  philtrum?: AutoMovieFaceWeight;
  /**
   * Vertical mouth position: `+` higher, `-` lower.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `height` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `height` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  height?: AutoMovieFaceWeight;
  /**
   * Resting corner lift (slight smile): `+` up, `-` down.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `smile` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `smile` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  smile?: AutoMovieFaceWeight;
}

/**
 * Cheeks and cheekbones.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieHeadCheek` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieHeadCheek` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieHeadCheek {
  /**
   * Soft cheek fullness: `+` fuller (youthful), `-` gaunt.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `fullness` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `fullness` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  fullness?: AutoMovieFaceWeight;
  /**
   * Malar/cheekbone prominence: `+` higher/sharper (mature beauty).
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `bones` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `bones` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  bones?: AutoMovieFaceWeight;
}

/**
 * Jaw and chin.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieHeadJaw` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieHeadJaw` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieHeadJaw {
  /**
   * Gonial/jaw width: `+` wider/squarer, `-` softer/tapered (feminine).
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `width` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `width` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  width?: AutoMovieFaceWeight;
  /**
   * Jaw drop / lower-face length at the angle.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `drop` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `drop` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  drop?: AutoMovieFaceWeight;
  /**
   * Chin vertical length: `+` longer, `-` shorter (feminine/childlike).
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `chinLength` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `chinLength` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  chinLength?: AutoMovieFaceWeight;
  /**
   * Chin width: `+` broader, `-` narrower/pointed.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `chinWidth` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `chinWidth` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  chinWidth?: AutoMovieFaceWeight;
  /**
   * Chin forward projection: `+` prominent, `-` recessive (East-Asian).
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `chinProjection` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `chinProjection` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  chinProjection?: AutoMovieFaceWeight;
}

/**
 * A full-head shape specification for the parametric head built on the clean
 * MakeHuman-derived base: the document the head editor's tool calling emits and
 * the engine projects (via `flattenHead`) onto
 * {@link AutoMovieHeadParameterName} morph weights the face package's
 * `morphHead` applies.
 *
 * Anatomy-grouped so an LLM reads it the way a person reads a face; every leaf
 * is a signed weight in `[-2, 2]` (`0` = the neutral average). Omitted fields
 * and groups mean neutral. This is the comprehensive identity/shape spec (cute
 * / beauty / plain archetypes and East-Asian cues are all reachable);
 * expression is out of scope.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieHead` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieHead` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieHead {
  /**
   * Cranium and overall proportion.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `shape` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `shape` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  shape?: IAutoMovieHeadShape;
  /**
   * Eyebrows.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `brow` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `brow` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  brow?: IAutoMovieHeadBrow;
  /**
   * Eyes (incl. epicanthus / eyelid fold).
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `eyes` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `eyes` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  eyes?: IAutoMovieHeadEyes;
  /**
   * Nose (incl. bridge height).
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `nose` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `nose` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  nose?: IAutoMovieHeadNose;
  /**
   * Mouth and lips.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `mouth` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `mouth` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  mouth?: IAutoMovieHeadMouth;
  /**
   * Cheeks and cheekbones.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `cheek` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `cheek` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  cheek?: IAutoMovieHeadCheek;
  /**
   * Jaw and chin.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `jaw` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `jaw` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  jaw?: IAutoMovieHeadJaw;
}
