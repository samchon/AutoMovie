import type { IPortraitComponent } from "../portraitComponents";
import {
  createPortraitReliefCurveLayer,
  createPortraitReliefLayer,
} from "../portraitRelief";
import type { IPortraitSurfaceLayer } from "../portraitSurface";
import {
  type IPortraitNasalDetail,
  portraitNasalLayerFor,
  portraitOrbitalRelief,
  portraitPerioralRelief,
  portraitPhiltralCurves,
} from "./anatomy";
import {
  type IPortraitCheekShape,
  type IPortraitCheekSocket,
  createPortraitCheekLayer,
} from "./cheeks";
import { referenceControlNet } from "./controlNet";
import { createPortraitDentalComponent } from "./dentalComponent";
import type { IPortraitDentalRow } from "./dentalRow";
import { portraitEyebrowProfile } from "./eyebrows";
import {
  type IPortraitEyeShape,
  type IPortraitEyeSocket,
  createPortraitEyeComponent,
} from "./eyes";
import type { IPortraitHairShape } from "./hairProxy";
import {
  type IPortraitMouthShape,
  type IPortraitMouthSocket,
  createPortraitMouthComponent,
} from "./mouth";
import type { IPortraitNasalSection } from "./nasalSection";
import {
  type IPortraitNoseShape,
  type IPortraitNoseSocket,
  createPortraitNoseComponent,
  portraitNostrilContains,
} from "./nose";
import {
  type IPortraitOrbitalSupportShape,
  createPortraitOrbitalSupport,
} from "./orbitalSupport";

/** Subject-owned continuous hair-cap boundary fit for the reference fringe. */
export const portraitHairShape: IPortraitHairShape = {
  // The photograph's heavier fringe falls toward anatomical +X. Keep the
  // offset within the cap's transition band so both sides remain continuous.
  fringeBias: 0.18,
};

/** Subject-specific attachments; component implementations contain no landmark IDs. */
export const portraitEyeSockets: IPortraitEyeSocket[] = [
  {
    name: "right",
    top: [33, 246, 161, 160, 159, 158, 157, 173, 133],
    bottom: [33, 7, 163, 144, 145, 153, 154, 155, 133],
    iris: 468,
    browTop: [70, 63, 105, 66, 107],
    browBottom: [46, 53, 52, 65, 55],
  },
  {
    name: "left",
    top: [362, 398, 384, 385, 386, 387, 388, 466, 263],
    bottom: [362, 382, 381, 380, 374, 373, 390, 249, 263],
    iris: 473,
    browTop: [336, 296, 334, 293, 300],
    browBottom: [285, 295, 282, 283, 276],
  },
];

/**
 * Subject-owned eye dimensions. Scale values are dimensionless; lengths use
 * millimetres and sampling/fibre counts are integers. Field-level contracts live
 * in IPortraitEyeShape. These authored values remain subject to visual fitting.
 */
export const portraitEyeShape: IPortraitEyeShape = {
  // Compensate the aperture's subdivision shrinkage at the subject level.
  // This fit is relative to its own measured socket, not a population norm.
  widthScale: 1.06,
  // Eye close review: the reference carries a longer almond-shaped horizontal
  // span than the subdivision-shrunk socket. Keep the optical radius fixed
  // while adding only this restrained six-percent horizontal aperture fit;
  // the vertical opening remains independently controlled below.
  openingScale: 0.92,
  outerCornerLift: 0,
  socketLift: 0,
  blendReach: 18,
  // Reserve the host patch before installing the wide lower-tissue section.
  // Deforming the old aperture into that outer seam folded neighbouring skin;
  // the shared annulus instead keeps the containing host boundary in place.
  skinAttachment: "reserve",
  // Keep the upper crease near the measured aperture. The lower roll belongs
  // immediately below its margin; a separate infraorbital layer supplies the
  // broader transition into the cheek. These millimetre dimensions are authored
  // image-guided fits, not population averages or clinical measurements.
  foldWidth: 1.6,
  foldDepth: 0.22,
  upperLidVolume: 0.18,
  // The source shows a roughly six-millimetre pretarsal roll immediately below
  // the lashes. Keep the crest visible, then let the lower shoulder fall away
  // before the preseptal field; this is visible fullness, not a bag or muscle
  // thickness estimate. These offsets reshape surrounding tissue while the
  // aperture remains its own rim.
  lowerLidWidth: 1.5,
  lowerLidVolume: 0.02,
  // Explicit tissue sections replace the two-control lower envelope within a
  // canthal fade. The roll, its lower boundary and the preseptal transition
  // have separate positions/projections. These mm values are a render-study
  // hypothesis, not adult anatomical averages or accepted subject dimensions.
  lowerLidProfile: {
    // The photographed aegyo-sal is a small pretarsal orbicularis roll, not a
    // broad lower-eye pad. Its crest therefore sits close to the margin and
    // carries most of the relief; the subtarsal rows fall back toward the host
    // skin before the preseptal transition. Width and projection remain
    // independent authored witnesses: changing only depth would preserve the
    // old horizontal band. These are visible surface offsets, not muscle
    // thickness or a clinical age model.
    // Keep the outer attachment and inner margin fixed while the transverse body
    // and its preseptal landing are fitted as one section. Positive relief alone
    // does not prevent a trough: the globe-to-skin bridge can lie behind both
    // boundaries. The adopted coupled study narrows the pretarsal/subtarsal
    // offsets. The crest is intentionally fuller than the lower shoulder, and
    // the shoulder loses relief before the preseptal landing; this keeps the
    // rounded body legible without extending a bag into the cheek after
    // subdivision.
    sections: [
      { at: 0, fullness: 0.2, width: 0.7 },
      { at: 0.16, fullness: 0.6, width: 0.9 },
      { at: 0.34, fullness: 0.92, width: 1 },
      { at: 0.5, fullness: 1, width: 1 },
      { at: 0.66, fullness: 0.92, width: 1 },
      { at: 0.84, fullness: 0.6, width: 0.9 },
      { at: 1, fullness: 0.2, width: 0.7 },
    ].map(({ at, fullness, width }) => ({
      at,
      section: {
        margin: { offset: 0.16, projection: 0.12 },
        pretarsalCrest: { offset: 1.1 * width, projection: 0.55 * fullness },
        pretarsalLower: { offset: 1.9 * width, projection: 0.28 * fullness },
        subtarsalInner: { offset: 2.7 * width, projection: 0.08 * fullness },
        subtarsalOuter: { offset: 3.8 * width, projection: 0.01 * fullness },
        preseptal: { offset: 5.2, projection: 0.0 },
        attachment: 6.2,
      },
    })),
  },
  lidThickness: 0.18,
  surfaceRadius: 18,
  // Schematic-eye optical dimensions, not measurements recovered from this
  // photo. The curvature, axial thickness and refractive index follow the
  // schematic dimensions cited in README.md; the globe remains an authored fit.
  cornealRadius: 7.8,
  cornealThickness: 0.55,
  cornealRimLift: 0.65,
  // Keep a circular optical boundary while the eyelids determine visibility.
  // This trial must inspect their contact: clipping a thick closed cornea to
  // the visible opening produced a raised flattened glass rim in close views.
  cornealBoundary: "limbus",
  lidContact: "cornea",
  lidContactReach: 3,
  // The observed iris-rim markers give horizontal radii of 6.36–6.47 mm after
  // pose removal. One radius fits this subject's two independently bound eyes.
  irisRadius: 6.1,
  pupilRadius: 2.35,
  // The source iris reads as dark brown under its captured illumination.
  // These are authored linear albedos, not colors sampled from image pixels.
  irisPigment: {
    base: [0.015, 0.009, 0.005],
    variation: [0.055, 0.03, 0.012],
  },
  // Visible tissue occupies the existing aperture; it does not move its skin
  // attachment or resize the eye. Values are authored millimetre fits. The
  // lower width stays within the iris patch's 0.15 mm lid clearance.
  tissues: {
    cornerLength: 1.4,
    caruncleProjection: 0.18,
    plicaProjection: 0.08,
    lowerMarginWidth: 0.15,
    lowerMarginLift: 0.035,
  },
  browFibres: 420,
  browProfile: { ...portraitEyebrowProfile },
  upperLashes: 24,
  sampling: { eyeColumns: 80, eyeRows: 28, irisColumns: 84, irisRows: 20 },
};

/** An alternate aperture and lid profile for exercising independent replacement. */
export const alternatePortraitEye: IPortraitEyeShape = {
  ...portraitEyeShape,
  widthScale: 1.08,
  openingScale: 0.78,
  outerCornerLift: 0.8,
  foldWidth: 0.85,
  foldDepth: 0.35,
  surfaceRadius: 20,
};

/** Measured nasal binding. Its original cut population remains stable across shapes. */
export const portraitNoseSocket: IPortraitNoseSocket = {
  // Nasal root and paired alar-facial support, rather than an arbitrary origin.
  supportPlane: [6, 129, 358],
  midline: 0,
  tipY: -6,
  tipRadius: [8, 9],
  alarOffset: 12.5,
  alarY: -13.5,
  alarRadius: 5.5,
  sectionAnchor: 4,
  surface: referenceControlNet.positions
    .slice(0, 468)
    .flatMap((point, id) =>
      Math.abs(point[0]) < 24 && point[1] >= -25 && point[1] < 15 ? [id] : [],
    ),
  nostrils: [-1, 1].map((side) => {
    const selected: number[] = [];
    for (let i = 0; i < referenceControlNet.indices.length; i += 3) {
      const triangle = referenceControlNet.indices
        .slice(i, i + 3)
        .map((id) => referenceControlNet.positions[id]);
      const x = triangle.reduce((sum, p) => sum + p[0], 0) / 3,
        y = triangle.reduce((sum, p) => sum + p[1], 0) / 3;
      if (
        portraitNostrilContains(x, y, {
          x: side * 10.3,
          y: -14.5,
          width: 4.3,
          height: 1.9,
        })
      )
        selected.push(i / 3);
    }
    return selected;
  }),
};

/**
 * Connected lower-nasal depth controls relative to retained tip datum 4.
 * Columns run from the anatomical right outer join through its alar body,
 * lower-tip shoulders and centre, then to the independent left-side controls.
 * Rows progress from the philtral root through the columellar turn, lower tip,
 * alar/dome body and lower dorsum. Every value is an authored millimetre fit.
 * These are cubic shape poles, not sampled anatomy or population dimensions.
 *
 * When selected, the grid is evaluated on the final refined exterior. Its absolute head-Z
 * target expresses the lower turn and paired alar sections directly, rather
 * than summing extra tip/ala inflation. The four-millimetre rectangular edge
 * transition joins the surrounding host. A separate six-millimetre collar
 * preserves the already fitted aperture's position and first derivative.
 * Aperture sizing and lining precede this exterior-only operation, so changing
 * these poles cannot refit their plane. This optional study profile is not
 * selected by the current assembly and has no accepted likeness claim.
 */
export const portraitNasalSection: IPortraitNasalSection = {
  transverse: [-22, -18, -12, -6, 0, 6, 12, 18, 22],
  stations: [
    // Inferior philtral root, meeting the unchanged host at the lower domain edge.
    { height: -18, depths: [-30, -27, -22, -18, -17.5, -18, -22, -27, -30] },
    // Control the columellar root's width through both lower-tip shoulders.
    { height: -14, depths: [-29, -25, -17, -13.5, -13, -13.5, -17, -25, -29] },
    { height: -10, depths: [-27, -21, -11, -4.8, -4, -4.8, -11, -21, -27] },
    // Paired alar bodies and central dome share the same transverse construction.
    { height: -6, depths: [-26, -13.5, -6.5, -0.8, 0, -0.8, -6.5, -13.5, -26] },
    { height: -2, depths: [-26, -12.8, -5.5, 1, 2, 1, -5.5, -12.8, -26] },
    // Guide the superior sections toward the unchanged bridge.
    {
      height: 2,
      depths: [-27, -16.5, -7.5, -0.8, 0.5, -0.8, -7.5, -16.5, -27],
    },
    { height: 6, depths: [-29, -23, -13.5, -5, -3.5, -5, -13.5, -23, -29] },
    { height: 10, depths: [-30, -25, -17, -9, -7, -9, -17, -25, -30] },
  ],
  joinWidth: 4,
  influence: 1,
};

/** Subject-owned nasal offsets and cavity dimensions; see IPortraitNoseShape for units. */
export const portraitNoseShape: IPortraitNoseShape = {
  widthScale: 1,
  // The original monocular depth is inferred. Scale it from the common facial
  // support so tip, sidewall and rim samples follow one projection relationship.
  // This fitting trial changes depth, not a claim that tip roundness is solved.
  depthScale: 0.78,
  // Local lobules, curve refinement and an exterior rim band remain optional.
  // Their tested presets did not improve the complete nasal surface, so the
  // active fit uses the prior basic construction rather than its pinched trial.
  // Zero offsets preserve the control net's inferred tip and alar depths.
  // The nostril frame controls aperture shape and orientation independently.
  // Give the bridge-to-tip turn a shallow central cushion. The positive
  // Gaussian is deliberately smaller than the alar relief so the tip joins
  // the bridge as one soft surface instead of becoming a second lobe.
  tipProjection: 0.85,
  // A restrained positive alar relief rounds the paired wing beneath each
  // opening while leaving the fitted nostril boundary and its topology intact.
  // Keep this small: the target has a soft ala, not a separate lateral bump.
  alarProjection: 0.45,
  // Aperture width/height are independent from its complete rim and lining's
  // shared eight-degree downward orientation. The current contour is provisional.
  // These are source-guided authored ratios, not measured airway dimensions.
  nostrilWidthScale: 0.88,
  nostrilHeightScale: 0.65,
  nostrilRise: 0,
  nostrilTilt: 8,
  cavityContraction: 0.6,
  rimSupport: 0.1,
  // Blend the sparse cut boundary towards its own fitted ellipse. The shared
  // skin and lining receive that same rim; orientation, centroid and connectivity
  // remain owned by the original opening. An optional final section grid cannot
  // move or independently reinterpret this aperture boundary.
  rimRoundness: 0.55,
  cavityOffset: [0, 3, -5],
  blendReach: 14,
};

/** A narrower, less projecting nose with smaller inferior openings. */
export const alternatePortraitNose: IPortraitNoseShape = {
  ...portraitNoseShape,
  widthScale: 0.94,
  tipProjection: -4,
  alarProjection: 1,
  nostrilWidthScale: 0.65,
  nostrilHeightScale: 0.7,
  nostrilRise: -0.4,
};

/** Measured vermilion and inner oral boundaries owned by this subject. */
export const portraitMouthSocket: IPortraitMouthSocket = {
  outer: [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0,
    37, 39, 40, 185,
  ],
  upper: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
  lower: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
  lipSeed: 11,
};

/** Subject-owned smile fit. Crown dimensions remain authored estimates, not a scan. */
export const portraitMouthShape: IPortraitMouthShape = {
  // The outer vermilion is an anatomical curve shared with neighbouring skin.
  // Its refinement should not inherit zigzags from opposite triangle vertices.
  borderRefinement: "curve",
  // The captured smile occupies a narrower, shallower oral frame than the
  // resident landmark cage. Keep the corner identities and dental group
  // shared, while letting the fitted vermilion carry that proportion as one
  // optional oral-frame control.
  widthScale: 0.86,
  openingScale: 0.8,
  cornerLift: 1,
  upperLipProjection: 0,
  lowerLipProjection: 0,
  // Thickness varies along the curved lower band independently of the smile's
  // inner aperture. The central pad remains broad; the lateral vermilion tapers
  // toward shared corners. These are provisional fit ratios, not measurements.
  band: {
    upper: [
      { at: -1, scale: 1 },
      { at: -0.65, scale: 0.8 },
      { at: 0, scale: 1.05 },
      { at: 0.65, scale: 0.8 },
      { at: 1, scale: 1 },
    ],
    lower: [
      { at: -1, scale: 1 },
      { at: -0.65, scale: 0.72 },
      { at: 0, scale: 0.95 },
      { at: 0.65, scale: 0.72 },
      { at: 1, scale: 1 },
    ],
  },
  // Add cross-sectional body between the existing cutaneous and oral borders.
  // The central upper tubercle and lower paired pads are independent from the
  // broad body. Projections use mm; widths/offsets use oral half-width fractions.
  // This provisional shape retains the photographed aperture and dental frame.
  section: {
    upperBody: 0.18,
    upperTubercle: 0.14,
    upperTubercleWidth: 0.33,
    lowerBody: 0.2,
    lowerPads: 0.04,
    lowerPadOffset: 0.28,
    lowerPadWidth: 0.26,
  },
  blendReach: 14,
  cavityDepth: 5,
  dentalOffset: -1.15,
  dentalRecess: 3.4,
  // Crown centres sit below the refined upper-lip guide. Review dentalDrop
  // together with crown height: their upper edges must remain behind the lip.
  dentalDrop: 5.2,
  dentalDepth: 1.5,
  toothGap: 0.08,
  crowns: [
    { width: 4.4, height: 8.0 },
    { width: 5.1, height: 8.3 },
    { width: 6, height: 8.8, cervicalWidth: 0.72, edgeRise: 1.05 },
    {
      width: 6.8,
      height: 9.2,
      cervicalWidth: 0.76,
      edgeRise: 0.65,
      contour: {
        mesial: { contactHeight: 0.29, incisalRise: 0.35, cervicalWidth: 0.81 },
        distal: { contactHeight: 0.43, incisalRise: 0.82, cervicalWidth: 0.74 },
      },
    },
    // The central incisors have a sharper mesial and rounder distal corner.
    // These optional fractions/mm are authored form fits. The arch supplies
    // mesial orientation, so neither crown owns an independent world placement.
    {
      width: 8.1,
      height: 9.7,
      cervicalWidth: 0.82,
      // The central incisor cutting edge is a shallow curved arc in the
      // reference smile. Keep crown height and the shared arch unchanged;
      // increase only the mesial/distal corner lift so the enamel reads as a
      // rounded incisal edge instead of a rectangular block.
      edgeRise: 0.9,
      contour: {
        mesial: { contactHeight: 0.22, incisalRise: 0.32, cervicalWidth: 0.85 },
        distal: { contactHeight: 0.35, incisalRise: 0.8, cervicalWidth: 0.78 },
      },
    },
    {
      width: 8.1,
      height: 9.8,
      cervicalWidth: 0.82,
      edgeRise: 0.95,
      contour: {
        mesial: { contactHeight: 0.2, incisalRise: 0.34, cervicalWidth: 0.84 },
        distal: { contactHeight: 0.36, incisalRise: 0.83, cervicalWidth: 0.77 },
      },
    },
    {
      width: 6.8,
      height: 9.2,
      cervicalWidth: 0.76,
      edgeRise: 0.65,
      contour: {
        mesial: { contactHeight: 0.29, incisalRise: 0.35, cervicalWidth: 0.81 },
        distal: { contactHeight: 0.43, incisalRise: 0.82, cervicalWidth: 0.74 },
      },
    },
    { width: 6, height: 8.8, cervicalWidth: 0.72, edgeRise: 1.05 },
    { width: 5.1, height: 8.3 },
    { width: 4.4, height: 8.0 },
  ],
};

/**
 * The upper row is one group: local arch dimensions own every tooth placement.
 * The authored enamel profiles are shared with the procedural study; the active
 * row has its own arch and attachment controls. Changing a crown recomputes
 * arc-distance centres for the complete group without sampling the lip shape.
 */
export const portraitDentalRow: IPortraitDentalRow = {
  halfWidth: 24,
  depth: 18,
  gap: 0.08,
  // Nominal arc gaps do not measure the rotating proximal surfaces. Fit those
  // resident crown meshes with a separate, small physical separation constraint.
  contactGap: 0.02,
  crowns: portraitMouthShape.crowns.map((crown) => ({
    ...crown,
    depth: 1.5,
    cervicalWidth: crown.cervicalWidth ?? 0.78,
    edgeRise: crown.edgeRise ?? 0.035 * crown.height,
  })),
};

/** Central upper lip and corner identities establish one oral frame. */
export const portraitDentalSocket = {
  rightCorner: 78,
  leftCorner: 308,
  upperLipMiddle: 13,
};

/**
 * One group placement in mm: positive lift hides gingival ends behind the upper
 * lip; positive recess moves the entire arch posteriorly. These are authored
 * estimates and require both profile views after every placement change.
 */
export const portraitDentalPlacement = { lift: 1.5, recess: 6 };

/**
 * Retained skin identities for the paired cheek masses and nasolabial paths.
 * The path begins beside the nasal wing and ends lateral to the mouth corner.
 * These bindings identify anatomy on this measured host; the layer factory
 * reads their final refined coordinates after eye, nose and mouth fitting.
 */
export const portraitCheekSockets: IPortraitCheekSocket[] = [
  {
    side: "right",
    malar: 118,
    medial: 205,
    buccal: 187,
    modiolus: 57,
    nasolabial: [98, 92, 186, 57],
  },
  {
    side: "left",
    malar: 347,
    medial: 425,
    buccal: 411,
    modiolus: 287,
    nasolabial: [327, 322, 410, 287],
  },
];

/**
 * Added soft-tissue relief in millimetres, fitted against the supplied smile.
 * Broad overlapping support gives the cheek a continuous envelope. The narrow
 * groove controls the transition into the lower perioral surface independently.
 * These are authored estimates; no measured fat thickness is claimed. Lift is
 * zero because the host already contains the photographed smile.
 */
export const portraitCheekShape: IPortraitCheekShape = {
  // The reference carries a broad, high malar cushion rather than a planar
  // cheek. Increase its shallow anterior turn and lift together so the light
  // rolls across one soft mass; the neighboring medial field remains a
  // separate transition control.
  malar: { width: 32, height: 34, reach: 40, projection: 4.8, lift: 0.7 },
  // This bound vertex lies lateral/inferior to the desired medial prominence.
  // Move the envelope inward/up relative to its live anchor; the cheek builder
  // mirrors the outward axis automatically. Keep lower cheek support smaller
  // so the smile's high medial mass does not become an enlarged lower cheek.
  medial: {
    offset: [-7, 6, 0],
    width: 29,
    height: 27,
    // Extend the medial malar field along the curved cheek-to-nose path while
    // lowering its crest. The wider support is a transition control, not a
    // second cheek mass, so its lower projection stays below the baseline.
    reach: 48,
    projection: 4.5,
    lift: 0.45,
  },
  // Keep the lower cheek's crest tight around its live support so the buccal
  // mass tapers into the mandibular plane instead of reading as one flat pad.
  // The downward centre shift leaves the malar field untouched and places the
  // transition below the smile rather than widening the midface.
  buccal: {
    offset: [0, -3, 0],
    width: 24,
    height: 27,
    reach: 35,
    projection: 1.2,
    lift: 0,
  },
  modiolus: { width: 12, height: 14, reach: 24, projection: 0.2, lift: 0 },
  foldWidth: 5,
  foldDepth: 0.45,
  foldReach: 30,
};

/** Select each cheek's shape independently while retaining subject-owned attachments. */
export function portraitCheekLayersFor(
  right: IPortraitCheekShape,
  left: IPortraitCheekShape,
): IPortraitSurfaceLayer[] {
  return [
    createPortraitCheekLayer(portraitCheekSockets[0], right),
    createPortraitCheekLayer(portraitCheekSockets[1], left),
  ];
}

/** Assemble independently selectable eyes, nose and mouth against this subject's sockets. */
export function portraitComponentsFor(
  rightEye: IPortraitEyeShape,
  leftEye: IPortraitEyeShape,
  nose: IPortraitNoseShape,
  mouth: IPortraitMouthShape = portraitMouthShape,
): IPortraitComponent[] {
  return [
    createPortraitEyeComponent(portraitEyeSockets[0], rightEye),
    createPortraitEyeComponent(portraitEyeSockets[1], leftEye),
    createPortraitNoseComponent(portraitNoseSocket, nose),
    createPortraitMouthComponent(portraitMouthSocket, mouth),
  ];
}

/**
 * Upper-orbit sections retained as authored data for both assembly and capture.
 * These small fitted displacements are not anatomical population dimensions.
 */
export const portraitOrbitalSupportShapes: readonly {
  side: "right" | "left";
  shape: IPortraitOrbitalSupportShape;
}[] = (["right", "left"] as const).map((side, i) => ({
  side,
  shape: {
    radius: 14,
    stations: (i === 0 ? [107, 105, 70] : [336, 334, 300]).map(
      (anchor, station) => ({
        name: ["medial", "middle", "lateral"][station],
        anchor,
        forehead: { height: 9, projection: 0 },
        browProjection: [0.6, 0.7, 0.25][station],
        sulcus: { descent: 8, projection: [0.03, -0.12, -0.05][station] },
      }),
    ),
  },
}));

/** Restore the basic nose and its original supports after the patch-join regression. */
export const portraitNasalSupportDetail: IPortraitNasalDetail | undefined =
  undefined;

/** Retained measured-cage baseline for independent component experiments. */
export const measuredPortraitAssembly = {
  hairProxy: true,
  components: portraitComponentsFor(
    portraitEyeShape,
    portraitEyeShape,
    portraitNoseShape,
  ),
  subdivisionRounds: 3,
  surfaceLayers: [
    ...portraitCheekLayersFor(portraitCheekShape, portraitCheekShape),
    // The restored procedural nose requires its original support field.
    portraitNasalLayerFor(portraitNasalSupportDetail),
    createPortraitReliefLayer("orbital-support", portraitOrbitalRelief),
    createPortraitReliefLayer("perioral-support", portraitPerioralRelief),
    createPortraitReliefCurveLayer("philtral-curves", portraitPhiltralCurves),
    // Upper orbital support belongs to skin form, independently of brow hair.
    // Paired small anterior pad sections sit between fixed forehead witnesses
    // and a shallow superior orbital sulcus. Values are fitting hypotheses.
    ...portraitOrbitalSupportShapes.map(({ side, shape }) =>
      createPortraitOrbitalSupport(side, shape),
    ),
  ],
};

/**
 * Active measured-surface assembly with a grouped dental interior. The skin
 * components own openings; the dental component attaches after shared skin
 * refinement. Disable the mouth's legacy crowns so the row has exactly one
 * owner. The procedural nose and its original support field restore the earlier
 * continuous skin. The later reference-patch experiments remain unaccepted and
 * are not selected here; their perimeter failures must not replace working form.
 */
export const portraitAssembly = {
  ...measuredPortraitAssembly,
  // An explicit 0.2 mm construction gap keeps the entire upper arch behind the
  // actual lip and the cavity behind the enamel, without per-crown distortion.
  oralContact: {
    lips: "lips",
    enamel: "tooth-upper-arch",
    cavity: "oral-cavity",
    clearance: 0.0002,
  },
  components: [
    ...portraitComponentsFor(
      portraitEyeShape,
      portraitEyeShape,
      portraitNoseShape,
      {
        ...portraitMouthShape,
        crowns: [],
      },
    ),
    createPortraitDentalComponent(
      portraitDentalSocket,
      portraitDentalRow,
      portraitDentalPlacement,
    ),
  ],
};
