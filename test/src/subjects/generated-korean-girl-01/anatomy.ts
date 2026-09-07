import type { IPortraitReliefRegion } from "../portraitRelief";

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
 * define the lip-to-chin transition. The photographed smile is already in the
 * measured cage; these settings do not apply another smile or move mouth corners.
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
    radius: [20, 7, 16],
    displacement: [0, 0, -0.2],
  },
  {
    name: "mental-support",
    anchor: 152,
    offset: [0, 12, 6],
    radius: [23, 18, 20],
    displacement: [0, 0, 0.5],
  },
];
