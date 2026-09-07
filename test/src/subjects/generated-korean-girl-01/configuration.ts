import type { IPortraitComponent } from "../portraitComponents";
import { createPortraitReliefLayer } from "../portraitRelief";
import type { IPortraitSurfaceLayer } from "../portraitSurface";
import {
  portraitNasalRelief,
  portraitOrbitalRelief,
  portraitPerioralRelief,
} from "./anatomy";
import {
  type IPortraitCheekShape,
  type IPortraitCheekSocket,
  createPortraitCheekLayer,
} from "./cheeks";
import { referenceControlNet } from "./controlNet";
import type { IPortraitDentalRow } from "./dentalRow";
import { portraitEyebrowProfile } from "./eyebrows";
import {
  type IPortraitEyeShape,
  type IPortraitEyeSocket,
  createPortraitEyeComponent,
} from "./eyes";
import {
  type IPortraitMouthShape,
  type IPortraitMouthSocket,
  createPortraitMouthComponent,
} from "./mouth";
import {
  type IPortraitNoseShape,
  type IPortraitNoseSocket,
  createPortraitNoseComponent,
  portraitNostrilContains,
} from "./nose";

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
  widthScale: 1.04,
  openingScale: 1.04,
  outerCornerLift: 0,
  socketLift: 0,
  blendReach: 18,
  foldWidth: 3.1,
  foldDepth: 0.28,
  upperLidVolume: 0.2,
  lowerLidWidth: 5.5,
  lowerLidVolume: 0.15,
  lidThickness: 0.22,
  surfaceRadius: 18,
  // Schematic-eye optical dimensions, not measurements recovered from this
  // photo. The curvature, axial thickness and refractive index follow the
  // schematic dimensions cited in README.md; the globe remains an authored fit.
  cornealRadius: 7.8,
  cornealThickness: 0.55,
  cornealRimLift: 0.65,
  // The observed iris-rim markers give horizontal radii of 6.36–6.47 mm after
  // pose removal. One radius fits this subject's two independently bound eyes.
  irisRadius: 6.4,
  pupilRadius: 2.55,
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
  midline: 0,
  tipY: -6,
  tipRadius: [8, 9],
  alarOffset: 12.5,
  alarY: -13.5,
  alarRadius: 5.5,
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

/** Subject-owned nasal offsets and cavity dimensions; see IPortraitNoseShape for units. */
export const portraitNoseShape: IPortraitNoseShape = {
  widthScale: 1,
  // Zero offsets preserve the control net's inferred tip and alar depths.
  // The nostril frame controls aperture shape and orientation independently.
  tipProjection: 0,
  alarProjection: 0,
  nostrilWidthScale: 1,
  nostrilHeightScale: 0.65,
  nostrilRise: 0,
  nostrilTilt: 0,
  cavityContraction: 0.6,
  rimSupport: 0.1,
  rimRoundness: 0,
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
  widthScale: 1,
  openingScale: 1,
  cornerLift: 0,
  upperLipProjection: 0,
  lowerLipProjection: 0,
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
    { width: 4.4, height: 8.5 },
    { width: 5.1, height: 8.8 },
    { width: 6, height: 9.3, cervicalWidth: 0.72, edgeRise: 1.15 },
    { width: 6.8, height: 9.8, cervicalWidth: 0.76, edgeRise: 0.5 },
    { width: 8.1, height: 10.4, cervicalWidth: 0.82, edgeRise: 0.22 },
    { width: 8.1, height: 10.5, cervicalWidth: 0.82, edgeRise: 0.3 },
    { width: 6.8, height: 9.8, cervicalWidth: 0.76, edgeRise: 0.5 },
    { width: 6, height: 9.3, cervicalWidth: 0.72, edgeRise: 1.15 },
    { width: 5.1, height: 8.8 },
    { width: 4.4, height: 8.5 },
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
  malar: { width: 30, height: 35, reach: 40, projection: 3.7, lift: 0 },
  medial: { width: 29, height: 33, reach: 40, projection: 3.8, lift: 0 },
  buccal: { width: 28, height: 33, reach: 35, projection: 2.5, lift: 0 },
  modiolus: { width: 12, height: 14, reach: 24, projection: 0.2, lift: 0 },
  foldWidth: 5,
  foldDepth: 0,
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
    createPortraitReliefLayer("nasal-subunits", portraitNasalRelief),
    createPortraitReliefLayer("orbital-support", portraitOrbitalRelief),
    createPortraitReliefLayer("perioral-support", portraitPerioralRelief),
  ],
};

/** Current target uses the fitted connected surface; legacy component knobs are separate. */
export const portraitAssembly = {
  foundation: "anatomical" as const,
  subdivisionRounds: 1,
};
