import {
  type IPortraitSurfaceControl,
  createPortraitControlLayer,
} from "../portraitControlLayer";
import {
  type IPortraitReliefCurve,
  type IPortraitReliefRegion,
  createPortraitReliefLayer,
} from "../portraitRelief";
import type { IPortraitSurfaceLayer } from "../portraitSurface";

/**
 * Optional coupled nasal detail. Omission retains the complete basic supports.
 * A provided population replaces that layer: its values prescribe total XYZ
 * movement at the named controls, not another addition to the old amplitudes.
 *
 * @author Samchon
 */
export interface IPortraitNasalDetail {
  /** Common compact radius in millimetres, governing the skin/lining transition. */
  radius: number;
  /** Shared named control population; explicit empty removes nasal relief. */
  controls: readonly IPortraitSurfaceControl[];
}

/** Resolve one nasal surface authority from basic or optional coupled detail. */
export function portraitNasalLayerFor(
  detail?: IPortraitNasalDetail,
): IPortraitSurfaceLayer {
  return detail === undefined
    ? createPortraitReliefLayer("nasal-subunits", portraitNasalRelief)
    : createPortraitControlLayer(
        "nasal-subunits",
        detail.radius,
        detail.controls,
      );
}

/**
 * Rejected study fit for the complete nasal field, retained for explicit
 * replacement experiments and absent from the active portrait. Dorsum, tip, columella
 * and alar-facial anchors are coupled so their requested movements hold together.
 * Both external skin and attached vestibular lining consume the same field.
 * These explicit mm offsets are authored depth/form hypotheses, not a scan.
 * The 0af74958 capture produced a broad flat tip, so numerical interpolation
 * does not establish an acceptable relationship between these control targets.
 */
export const portraitNasalDetail: IPortraitNasalDetail = {
  radius: 22,
  controls: [
    {
      name: "dorsal-root",
      anchor: 6,
      offset: [0, 0, 0],
      displacement: [0, 0, 0],
    },
    {
      name: "lower-dorsum",
      anchor: 5,
      offset: [0, 0, 0],
      displacement: [0, 0, 0],
    },
    {
      name: "tip-centre",
      anchor: 4,
      offset: [0, 0, 0],
      displacement: [0, -1, -1],
    },
    {
      name: "right-tip-dome",
      anchor: 45,
      offset: [0, 0, 0],
      displacement: [-0.2, -0.4, 0.3],
    },
    {
      name: "left-tip-dome",
      anchor: 275,
      offset: [0, 0, 0],
      displacement: [0.2, -0.4, 0.3],
    },
    {
      name: "columellar-turn",
      anchor: 19,
      offset: [0, 0, 0],
      displacement: [0, -1.8, 0.5],
    },
    {
      name: "columellar-root",
      anchor: 2,
      offset: [0, 0, 0],
      displacement: [0, -0.5, 1],
    },
    {
      name: "right-alar-body",
      anchor: 49,
      offset: [0, 0, 0],
      displacement: [-0.3, -1, 3.5],
    },
    {
      name: "left-alar-body",
      anchor: 279,
      offset: [0, 0, 0],
      displacement: [0.3, -1, 3.5],
    },
    {
      name: "right-alar-facial-join",
      anchor: 129,
      offset: [0, 0, 0],
      displacement: [0, 0, 0],
    },
    {
      name: "left-alar-facial-join",
      anchor: 358,
      offset: [0, 0, 0],
      displacement: [0, 0, 0],
    },
  ],
};

/**
 * Nasal subunit supports on this subject's connected skin. The measured dorsal
 * path and the resized nasal openings remain the base; these local envelopes
 * supply the paired tip domes, alar lobules, alar-facial separation and columella.
 * The domes overlap across the midline rather than forming a pointed single
 * peak. Broader alar support and a shallow lateral boundary establish a rounded
 * wing together; the aperture alone must not stand in for that exterior volume.
 * They deform both exterior skin and attached lining continuously. Values are
 * authored millimetre fits, not recovered cartilage or soft-tissue measurements.
 */
export const portraitNasalRelief: IPortraitReliefRegion[] = [
  {
    name: "right-tip-dome",
    anchor: 4,
    offset: [-4.2, -1.5, 0],
    radius: [9, 9, 16],
    displacement: [-0.25, 0, 1.4],
  },
  {
    name: "left-tip-dome",
    anchor: 4,
    offset: [4.2, -1.5, 0],
    radius: [9, 9, 16],
    displacement: [0.25, 0, 1.4],
  },
  {
    name: "lower-dorsum",
    anchor: 5,
    offset: [0, 0, 0],
    radius: [12, 17, 20],
    displacement: [0, 0, 0.2],
  },
  {
    name: "right-alar-lobule",
    anchor: 49,
    offset: [0, -2, 0],
    radius: [11, 13, 17],
    displacement: [-0.45, 0, 2.6],
  },
  {
    name: "left-alar-lobule",
    anchor: 279,
    offset: [0, -2, 0],
    radius: [11, 13, 17],
    displacement: [0.45, 0, 2.6],
  },
  {
    name: "right-alar-facial-groove",
    anchor: 129,
    offset: [-0.5, 0, 4],
    radius: [5, 11, 14],
    displacement: [0, 0, -0.55],
  },
  {
    name: "left-alar-facial-groove",
    anchor: 358,
    offset: [0.5, 0, 4],
    radius: [5, 11, 14],
    displacement: [0, 0, -0.55],
  },
  {
    name: "columellar-support",
    anchor: 2,
    offset: [0, 2, 4],
    radius: [5, 8, 18],
    displacement: [0, 0, 0.5],
  },
];

/**
 * Lower orbital support blends the lid into the upper cheek. Its broad volume
 * is separate from the narrow eyelid margin and from the medial tear-trough
 * depression, so lid thickness does not stand in for the whole under-eye region.
 */
export const portraitOrbitalRelief: IPortraitReliefRegion[] = [
  {
    name: "right-medial-upper-orbit-support",
    anchor: 107,
    offset: [0, -9, -4],
    radius: [6, 8, 7],
    displacement: [0, 0, 0.22],
  },
  {
    name: "left-medial-upper-orbit-support",
    anchor: 336,
    offset: [0, -9, -4],
    radius: [6, 8, 7],
    displacement: [0, 0, 0.22],
  },
  {
    name: "right-infraorbital-support",
    anchor: 145,
    offset: [0, -5, 0],
    radius: [22, 12, 20],
    displacement: [0, 0, 1.4],
  },
  {
    name: "left-infraorbital-support",
    anchor: 374,
    offset: [0, -5, 0],
    radius: [22, 12, 20],
    displacement: [0, 0, 1.4],
  },
  {
    name: "right-medial-tear-trough",
    anchor: 133,
    offset: [-2, -5, 2],
    radius: [8, 3.5, 12],
    displacement: [0, 0, 0],
  },
  {
    name: "left-medial-tear-trough",
    anchor: 362,
    offset: [2, -5, 2],
    radius: [8, 3.5, 12],
    displacement: [0, 0, 0],
  },
];

/**
 * Philtral columns flank a shallow central groove above the upper vermilion.
 * Below the lower vermilion, a separate labiomental depression and chin support
 * define the lip-to-chin transition. The cage supplies the current projected
 * smile correspondence and inferred depth, not a validated lip/cheek surface.
 * These settings do not apply another smile or move mouth corners. The column
 * fields are compact basic supports; they do not yet own continuous philtral
 * curves from the nasal base to the Cupid peaks or the cutaneous lip section.
 */
export const portraitPerioralRelief: IPortraitReliefRegion[] = [
  {
    name: "right-philtral-column",
    anchor: 0,
    offset: [-3, 5, 1],
    radius: [3, 8, 13],
    displacement: [0, 0, 0.25],
  },
  {
    name: "left-philtral-column",
    anchor: 0,
    offset: [3, 5, 1],
    radius: [3, 8, 13],
    displacement: [0, 0, 0.25],
  },
  {
    name: "philtral-groove",
    anchor: 0,
    offset: [0, 5, 1],
    radius: [2.5, 8, 13],
    displacement: [0, 0, -0.1],
  },
  {
    name: "labiomental-groove",
    anchor: 17,
    offset: [0, -6, -1],
    radius: [22, 8, 18],
    displacement: [0, 0, -0.12],
  },
  {
    name: "mental-support",
    anchor: 152,
    offset: [0, 12, 6],
    radius: [27, 20, 22],
    displacement: [0, 0, 0.25],
  },
];

/**
 * Narrow paired philtral crests run from subnasale to the two Cupid peaks.
 * Each curve keeps its own root, taper and terminal support while the shared
 * curve-layer sampler interpolates overlapping fields along the path. The
 * small forward values describe the cutaneous white roll; they do not repaint
 * the vermilion or move the retained mouth border. Anchors 0, 82 and 312 are
 * subject-owned landmarks from the frozen control net, and the offsets keep
 * the controls on the fitted host after its surface residual is applied.
 */
export const portraitPhiltralCurves: IPortraitReliefCurve[] = [
  {
    name: "right-philtral-crest",
    points: [
      {
        anchor: 0,
        offset: [-2.2, -1.4, -0.3],
        radius: [2.1, 3.2, 4.4],
        displacement: [0, 0, 0.12],
      },
      {
        anchor: 0,
        offset: [-3.6, -2.5, -1.3],
        radius: [1.9, 3, 4.1],
        displacement: [0, 0, 0.2],
      },
      {
        anchor: 82,
        offset: [0, 0, 0],
        radius: [1.7, 2.8, 3.8],
        displacement: [0, 0, 0.08],
      },
    ],
  },
  {
    name: "left-philtral-crest",
    points: [
      {
        anchor: 0,
        offset: [2.2, -1.4, -0.3],
        radius: [2.1, 3.2, 4.4],
        displacement: [0, 0, 0.12],
      },
      {
        anchor: 0,
        offset: [3.6, -2.5, -1.3],
        radius: [1.9, 3, 4.1],
        displacement: [0, 0, 0.2],
      },
      {
        anchor: 312,
        offset: [0, 0, 0],
        radius: [1.7, 2.8, 3.8],
        displacement: [0, 0, 0.08],
      },
    ],
  },
];
