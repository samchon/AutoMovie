import type { IPortraitEyebrowProfile } from "./eyebrows";
import type { IPortraitEyelashProfile } from "./eyelashes";
import type { IPortraitIrisPigment } from "./irisPigment";
import type { IPortraitLowerLidProfile } from "./lowerLidSection";
import type { IPortraitOcularTissueShape } from "./ocularTissues";
import type { IPortraitUpperLidProfile } from "./upperLidSection";

/**
 * One subject-owned eye socket. Ordered lid curves run from negative to positive
 * local X; the component receives their identities instead of embedding them.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Binds a replaceable eye to caller-owned canthi, aperture curves, gaze marker and brow boundaries.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines ordered resident upper/lower rim identities and anatomical handedness without embedding any person's landmark numbers.
 */
export interface IPortraitEyeSocket {
  /** Anatomical side; positive host X is left. */
  name: "left" | "right";
  /** Upper aperture rim from negative X to positive X, including both corners. */
  top: number[];
  /** Lower rim in the same direction, including the same corner identities. */
  bottom: number[];
  /** Non-skin measured gaze marker. */
  iris: number;
  /** Upper brow boundary, in the same X order. */
  browTop: number[];
  /** Lower brow boundary, in the same X order. */
  browBottom: number[];
}

/**
 * Optional one-body pretarsal roll. These values shape visible surface
 * fullness in the lower-lid construction; they are not a claim about muscle
 * thickness or a detached tissue mesh.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Separates optional pretarsal fullness from optical contact and the upper-lid fold.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines one continuous lower roll with metric crest/shoulder dimensions and optional seven-station medial-to-lateral weights.
 * @author Samchon
 */
export interface IPortraitAegyoSalShape {
  /** Distance from the lower-lid margin to the roll crest, in millimetres. */
  offset: number;
  /** Positive anterior relief at the crest, in millimetres. */
  projection: number;
  /** Full transverse roll width, in millimetres. */
  width: number;
  /** Crest-to-shoulder distance, in millimetres. */
  height: number;
  /** Positive support reach used to validate the authored section. */
  reach: number;
  /** Optional medial-to-lateral weights for the seven lower-lid witnesses. */
  weights?: readonly number[];
}

/**
 * Numerical eye shape independent of its host socket. Lengths are millimetres;
 * width/opening multipliers deform the fitted aperture, not an isolated eyeball.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Separates aperture, eyelid tissue, cornea, iris/pupil, lashes and brow controls within one eye.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines replaceable metric eye profiles with independent optical dimensions, lower-lid sections, attachment modes and tessellation controls.
 */
export interface IPortraitEyeShape {
  /** Multiplier of the socket aperture width; one retains its measured width. */
  widthScale: number;
  /** Multiplier of aperture height; one retains the measured opening. */
  openingScale: number;
  /** Upward outer-corner displacement, fading towards the inner corner, in mm. */
  outerCornerLift: number;
  /** Socket translation along the recorded camera ray, in mm. */
  socketLift: number;
  /**
   * Independent globe translation along the normalized observation ray, in mm.
   * Positive advances the optical body toward that camera; negative recesses
   * it. Outer skin attachment targets do not translate with it; shared skin
   * refinement and final contact still settle the emitted surface. Omission
   * and zero preserve the fitted globe. This is an
   * identity depth control, not gaze, blink or a measured clinical displacement.
   */
  globeLift?: number;
  /** Geodesic reach of surrounding skin adaptation, in mm. */
  blendReach: number;
  /**
   * Optional surrounding-skin reservation. Reserve cuts a containing host patch
   * before installing the lid rows and connects its unchanged outer boundary
   * through a shared annulus. Omission retains the original boundary-deformation
   * path. This changes attachment topology, not the eye's optical dimensions.
   */
  skinAttachment?: "reserve";
  /** Sample original skin at each reserved bridge triangle's interior before subdivision; omission preserves the original boundary-only annulus. */
  skinBridge?: "sampled";
  /** Upper lid fold width, in mm. */
  foldWidth: number;
  /** Upper crease depth behind the lid ridge, in mm. */
  foldDepth: number;
  /** Additional upper tarsal volume in front of the aperture plane, in mm. */
  upperLidVolume: number;
  /**
   * Optional complete upper tissue sections, ordered medial to lateral. These
   * replace basic fold/volume rows within the canthal sine fade; they do not
   * add a second relief layer. Omission preserves the original upper formula.
   */
  upperLidProfile?: IPortraitUpperLidProfile;
  /** Width of the lower eyelid's soft-tissue transition, in mm. */
  lowerLidWidth: number;
  /** Peak lower-lid roll projection, in mm; independent of the upper fold. */
  lowerLidVolume: number;
  /**
   * Optional complete lower-tissue sections, ordered medial to lateral. The
   * section owns pretarsal body, subtarsal boundary and preseptal transition.
   * A sine fade blends it to the basic canthi; omission is the exact basic row
   * formula. Ocular contact owns its inner support; a separate final check
   * resolves residual penetration after shared refinement and surface layers.
   */
  lowerLidProfile?: IPortraitLowerLidProfile;
  /**
   * Optional grouped pretarsal roll relief immediately below the lashes.
   * Omission preserves the eyelid-only construction; when supplied, the eye
   * component replaces its lower profile's competing rows with one continuous
   * rounded crest and a short lower shoulder.
   */
  aegyoSal?: IPortraitAegyoSalShape;
  /** Forward projection of the inner lid margin, in mm. */
  lidThickness: number;
  /** Spherical surface radius in mm; fitted in the socket plane independently of gaze. */
  surfaceRadius: number;
  /**
   * Depth-fitting direction for the spherical cap. Omission/aperture-plane
   * preserves the canthal-plane fit. Observation-ray keeps the reference rim
   * mean's image position when fitting centre depth; it does not recover an
   * anatomical globe centre. Current gaze and blink do not choose this mode.
   * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Selects an explicit ocular placement basis without changing current expression or forcing a new fit onto existing documents.
   * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Carries the optional canthal-plane or recorded-ray depth fitting choice to the spherical support builder.
   */
  sphereFit?: "aperture-plane" | "observation-ray";
  /**
   * Iris/cornea frame. Omission or head-plane preserves the original XY height
   * field. Radial authors both layers around the globe-to-iris axis, with
   * unchanged local radii and thickness. Requires full limbus and corneal
   * contact, and keeps a complete globe even without expression performance.
   */
  opticalFrame?: "head-plane" | "radial";
  /** Corneal curvature radius in mm; greater than iris radius and no greater than globe radius. */
  cornealRadius: number;
  /** Positive axial thickness of the closed anterior optical shell, in mm. */
  cornealThickness: number;
  /** Corneal rim's lift above the globe, in mm; clears the underlying iris surface. */
  cornealRimLift: number;
  /**
   * Closed optical boundary: omission or aperture retains visible-aperture
   * clipping; limbus keeps the complete circular cornea independent of the lids.
   * The latter separates optical anatomy from visibility. It does not itself
   * refit lid contact to the larger volume, which requires rendered inspection.
   */
  cornealBoundary?: "aperture" | "limbus";
  /**
   * Optional ocular contact basis. Omission or globe retains the basic rows;
   * cornea first places the inner section support on the actual full corneal
   * mesh along viewRay, then resolves residual refined-skin penetration with
   * lidThickness clearance. It requires limbus boundary and preserves the
   * recorded projection coordinates of each boundary contact.
   */
  lidContact?: "globe" | "cornea";
  /** Post-contact skin adaptation distance in mm; omission uses 3, zero keeps the face-contact targets without neighbouring adaptation. */
  lidContactReach?: number;
  /** Iris radius in mm before clipping against the fitted eyelid. */
  irisRadius: number;
  /** Pupil radius in mm; smaller than the iris. */
  pupilRadius: number;
  /** Optional instance-owned linear-RGB pigment; omission uses the shared legacy palette. */
  irisPigment?: IPortraitIrisPigment;
  /** Optional medial conjunctiva and lower lid margin; omission leaves them absent. */
  tissues?: IPortraitOcularTissueShape;
  /** Number of independently generated brow fibres, in [0,4096]; zero disables them. */
  browFibres: number;
  /** Optional fibre dimensions and skin clearance; omission uses the declared brow profile. */
  browProfile?: IPortraitEyebrowProfile;
  /** Number of upper lashes. */
  upperLashes: number;
  /** Optional upper-lash arc, launch and cross-section profile; omission preserves the original short-lash formula. */
  upperLashProfile?: IPortraitEyelashProfile;
  /** Tessellation controls, separate from the anatomical shape. */
  sampling: {
    eyeColumns: number;
    eyeRows: number;
    irisColumns: number;
    irisRows: number;
  };
}
