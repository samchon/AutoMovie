import type { IPortraitReliefRegion } from "../portraitRelief";

/**
 * Separate dorsal and alar-facial transitions on this subject's connected skin.
 * The nose component's section loft owns the central tip, paired alar bodies
 * and columellar turn before it derives the shared aperture and lining. Their
 * former overlapping projection envelopes are absent, so the new depth basis
 * does not receive a duplicate volume correction after refinement.
 *
 * These remaining fields retain the broad dorsal transition and shallow lateral
 * alar-facial separation. They act on both skin and attached lining through the
 * common refined host. Values are authored millimetre fits, not recovered
 * cartilage or soft-tissue measurements. Non-nasal cheek support remains owned
 * by its independent layer and still contributes to the lateral alar region.
 */
export const portraitNasalRelief: IPortraitReliefRegion[] = [
  {
    name: "lower-dorsum",
    anchor: 5,
    offset: [0, 0, 0],
    radius: [12, 17, 20],
    displacement: [0, 0, 0.2],
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
