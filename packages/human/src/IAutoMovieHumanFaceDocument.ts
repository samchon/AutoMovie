import type {
  IAutoMovieMaterial,
  IAutoMovieVector3,
} from "@automovie/interface";

import type {
  IPortraitCheekShape,
  IPortraitCheekSocket,
} from "./components/cheeks";
import type { IPortraitNeckShape } from "./components/cranium";
import type { IPortraitCraniumShape } from "./components/craniumShape";
import type { createPortraitDentalComponent } from "./components/dentalComponent";
import type { IPortraitDentalRow } from "./components/dentalRow";
import type { IPortraitEarShape } from "./components/ears";
import type { IPortraitEyeShape, IPortraitEyeSocket } from "./components/eyes";
import type { IPortraitFacialFrameShape } from "./components/facialFrame";
import type { IPortraitHairShape } from "./components/hairCards";
import type {
  IPortraitMouthShape,
  IPortraitMouthSocket,
} from "./components/mouth";
import type {
  IPortraitNoseShape,
  IPortraitNoseSocket,
} from "./components/nose";
import type { IPortraitOrbitalSupportShape } from "./components/orbitalSupport";
import type { IPortraitComponentHost } from "./geometry/portraitComponents";
import type {
  IPortraitReliefCurve,
  IPortraitReliefRegion,
} from "./geometry/portraitRelief";

/**
 * An object override recurses through fields; an array replaces its whole
 * population, including an explicitly empty optional population.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Distinguishes object-field overrides from complete array replacement.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Defines the typed override interpretation without mutating the basis recipe.
 * @author Samchon
 */
export type AutoMovieHumanFaceOverride<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: AutoMovieHumanFaceOverride<T[K]> }
    : T;

/**
 * Complete subject-owned part profiles. These are shape inputs, not a mesh
 * cache or a population preset. Optional supports retain their version defaults.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Owns the component profiles from which one anatomical face is built.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Connects part geometry, skin supports, dentition and cervical continuation.
 * @author Samchon
 */
export interface IAutoMovieHumanFaceRecipe {
  /** Optional surface-based scalp locks, authored in head millimetres. Omission adds no hairstyle. */
  hair?: IPortraitHairShape;
  /** Shared craniofacial proportions and named jaw/chin/forehead/temple supports; omission is identity. */
  frame?: IPortraitFacialFrameShape;
  /** Common optical, eyelid and brow profile before side-specific overrides. */
  eye: IPortraitEyeShape;
  /** Nasal exterior and cavity profile in the basis's nasal binding. */
  nose: IPortraitNoseShape;
  /** Lip and oral-cavity profile. Separate dentition requires an empty legacy crowns array. */
  mouth: IPortraitMouthShape;
  /** Common malar, medial, buccal and modiolus supports; omission adds no cheek layer. */
  cheek?: IPortraitCheekShape;
  /** Complete right and left upper-orbit section groups; omission adds no orbital layer. */
  orbits?: {
    right: IPortraitOrbitalSupportShape;
    left: IPortraitOrbitalSupportShape;
  };
  /** Cranial sections; omission retains the version-one continuation. */
  cranium?: IPortraitCraniumShape;
  /** Cervical sections and crop; omission retains the version-one neck. */
  neck?: IPortraitNeckShape;
  /** Common pinna profile; omission retains the version-one pinna. */
  ear?: IPortraitEarShape;
  /** Optional independently constructed upper arch and whole-group oral placement. */
  dentition?: {
    /** Ordered individual crown profiles, arch shape and spacing. */
    row: IPortraitDentalRow;
    /** Upward lift and posterior recess from the upper oral anchor, in mm. */
    placement: Parameters<typeof createPortraitDentalComponent>[2];
  };
  /** Optional independently authored mandibular enamel, rigidly attached to the jaw hinge. */
  lowerDentition?: {
    /** Lower crown profiles and arch; no upper-row size assumptions are imposed. */
    row: IPortraitDentalRow;
    /** Inferior cervical-plane drop and posterior recess from the observed lower inner-lip midpoint, in nonnegative mm. */
    placement: { drop: number; recess: number };
  };
  /** Additional named skin supports; this does not substitute for the part profiles above. */
  relief?: readonly { id: string; regions: readonly IPortraitReliefRegion[] }[];
  /** Additional connected named skin curves, such as philtral crests. */
  curves?: readonly { id: string; curves: readonly IPortraitReliefCurve[] }[];
}

/**
 * Source-independent attachment identities on a 478-landmark facial basis.
 * Coordinates are basis observations; these bindings identify anatomy rather
 * than pretending arbitrary vertex movement is a detail-control system.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-document Preserves one document's topology and anatomical bindings for independent replay.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-document Binds the versioned landmark interpretation to the recorded host.
 * @author Samchon
 */
export interface IAutoMovieHumanFaceBindings {
  /** Independent anatomical right and left eyes with their own gaze markers. */
  eyes: { right: IPortraitEyeSocket; left: IPortraitEyeSocket };
  /** Nasal host support and original cavity cut populations. */
  nose: IPortraitNoseSocket;
  /** Vermilion and oral boundary identities. */
  mouth: IPortraitMouthSocket;
  /** Paired cheek attachments; required when a cheek profile is selected. */
  cheeks?: { right: IPortraitCheekSocket; left: IPortraitCheekSocket };
  /** Upper arch attachment; required when separate dentition is selected. */
  dentition?: Parameters<typeof createPortraitDentalComponent>[0];
  /** Authored transverse mandibular hinge centre in head millimetres; required for nonzero observed or current jaw opening. */
  jawHinge?: IAutoMovieVector3;
}

/**
 * Intermediate anatomical controls, expressed as offsets from the recorded
 * recipe. Zero retains that recipe; final detail values are resolved afterward.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Separates intermediate trait offsets from detailed part settings.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Gives every intermediate value a fixed neutral and signed interpretation.
 * @author Samchon
 */
export interface IAutoMovieHumanFaceControls {
  /** Facial transverse scale offset in [-0.2,0.2]; positive widens the shared host. */
  faceWidth?: number;
  /** Nasion-centred facial length scale offset in [-0.2,0.2]; positive lengthens. */
  faceLength?: number;
  /** Eye aperture width ratio offset in [-0.4,0.4]; positive widens both eyes. */
  eyeWidth?: number;
  /** Eye aperture height ratio offset in [-0.4,0.4]; positive enlarges the identity aperture, not blink. */
  eyeHeight?: number;
  /** Outer canthus vertical offset in [-4,4] mm; positive raises both lateral corners. */
  eyeTilt?: number;
  /** Nasal width ratio offset in [-0.4,0.4]; positive widens the exterior and bound cavities. */
  noseWidth?: number;
  /** Nasal tip projection offset in [-8,8] mm; positive moves the tip anteriorly. */
  noseProjection?: number;
  /** Oral width ratio offset in [-0.4,0.4]; positive widens the bound vermilion. */
  mouthWidth?: number;
  /** Upper vermilion anterior projection offset in [-3,3] mm. */
  upperLipProjection?: number;
  /** Lower vermilion anterior projection offset in [-3,3] mm. */
  lowerLipProjection?: number;
  /** Malar and medial cheek projection offset in [-5,5] mm; requires a cheek profile. */
  cheekProjection?: number;
  /** Cranial station half-width ratio offset in [-0.3,0.3]. */
  craniumWidth?: number;
  /** Superior cranial envelope vertical offset in [-20,20] mm. */
  craniumHeight?: number;
  /** Pinna outline height ratio offset in [-0.3,0.3]; preserves the host attachment. */
  earHeight?: number;
  /** Cervical section transverse-width ratio offset in [-0.3,0.3]. */
  neckWidth?: number;
}

/**
 * Facial performance separate from identity. A source basis records its own
 * expression in these same units; the current expression is evaluated relative
 * to that observation. Omitted channels are zero, which denotes neutral.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Separates neutral, observed and currently requested facial performance.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Declares paired lids and brows, oral performance and gaze independently of optical size.
 * @author Samchon
 */
export interface IAutoMovieHumanFaceExpression {
  /** Paired eyelid closure fractions in [0,1]; one is closed. */
  blink?: { right?: number; left?: number };
  /** Paired brow elevation in [-6,8] mm; negative lowers the brow. */
  browRaise?: { right?: number; left?: number };
  /** Paired mouth-corner elevation in [-5,8] mm; positive is a smile direction. */
  smile?: { right?: number; left?: number };
  /** Inferior mandibular rotation in [0,25] degrees about the bound jaw hinge. */
  jawOpen?: number;
  /** Central lip separation in [0,30] mm before mandibular rotation; zero closes the paired oral margins. */
  lipPart?: number;
  /** Lip protrusion in [0,4] mm with coupled transverse narrowing. */
  pucker?: number;
  /** Paired vertical gaze angles in [-20,20] degrees; positive looks up. */
  gazePitch?: { right?: number; left?: number };
  /** Paired horizontal gaze angles in [-25,25] degrees; positive looks towards anatomical left. */
  gazeYaw?: { right?: number; left?: number };
}

/**
 * A replayable procedural face, with observed basis, author-owned shape,
 * explicit side overrides and expression. Photographs and measurement tools
 * are provenance only and never executable replay dependencies.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-document Stores an independent versioned face document with basis, detail, asymmetry and appearance.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-document Separates observed topology and shape settings from deterministic interpretation.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-provenance Retains the selected photo URL, byte digest, known author/license and source-quality decision without fetching it.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-provenance Uses an optional reference with nullable unknown facts; it never participates in shape resolution.
 * @evidenceExclude requirements/actors/facial-authoring/contract.md#actor-face-review Subject inventories, rendered-view observations and likeness decisions belong to the authoring study, not the replayable face document or geometry library.
 * @evidenceExclude specifications/asset-and-representation/facial-authoring/contract.md#face-spec-review The library emits a model for external capture and inspection; it does not issue a subjective likeness verdict or a per-study review receipt.
 * @author Samchon
 */
export interface IAutoMovieHumanFaceDocument {
  /** Supported interpretation version; unknown versions are refused rather than guessed. */
  version: "human-face/1";
  /** Nonempty caller-owned identity, independent from any photograph filename. */
  id: string;
  /** Human-readable label, not a runtime subject selector. */
  name: string;
  /** Immutable observed or authored shape and attachment foundation. */
  basis: {
    /** Caller-owned basis revision; changing it makes prior derived reviews stale. */
    id: string;
    /** Landmark topology interpretation used by this version's cranial continuation. */
    topology: "mediapipe-478/1";
    /** Host in head millimetres; image XY is observed, monocular depth is inferred. */
    host: IPortraitComponentHost;
    /** Anatomical socket and group identities on this host. */
    bindings: IAutoMovieHumanFaceBindings;
    /** Complete baseline part shapes; no named-person defaults are embedded in the package. */
    recipe: IAutoMovieHumanFaceRecipe;
    /** Expression already present in the host. Empty means an authored neutral basis. */
    expression: IAutoMovieHumanFaceExpression;
  };
  /** Optional intermediate trait offsets; omitted channels are zero. */
  controls?: IAutoMovieHumanFaceControls;
  /** Explicit detailed overrides after intermediate controls; arrays replace whole populations. */
  detail?: AutoMovieHumanFaceOverride<IAutoMovieHumanFaceRecipe>;
  /** Independent side profiles after common detail; omission keeps the common profile. */
  asymmetry?: {
    /** Anatomical right side (-X). */
    right?: {
      eye?: AutoMovieHumanFaceOverride<IPortraitEyeShape>;
      cheek?: AutoMovieHumanFaceOverride<IPortraitCheekShape>;
      ear?: AutoMovieHumanFaceOverride<IPortraitEarShape>;
    };
    /** Anatomical left side (+X). */
    left?: {
      eye?: AutoMovieHumanFaceOverride<IPortraitEyeShape>;
      cheek?: AutoMovieHumanFaceOverride<IPortraitCheekShape>;
      ear?: AutoMovieHumanFaceOverride<IPortraitEarShape>;
    };
  };
  /** Complete base material palette; omission uses version-one defaults, not photograph colours. */
  appearance?: readonly IAutoMovieMaterial[];
  /** Current performance; omission means neutral, not the source's expression. */
  expression?: IAutoMovieHumanFaceExpression;
  /** Optional source facts, never used to fetch or fit geometry during replay. */
  reference?: {
    /** Original or replacement URL, or null for a wholly authored basis. */
    url: string | null;
    /** Original downloaded byte identity, or null when no photograph exists. */
    sha256: string | null;
    /** Known author, or null when not established. */
    author: string | null;
    /** Established license, or null when not established. */
    license: string | null;
    /** Source selection and visible quality limitations. */
    decision: string;
  };
}
