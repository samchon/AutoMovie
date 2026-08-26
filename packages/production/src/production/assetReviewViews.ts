import type { IAutoMovieAssetTurntableView } from "@automovie/interface";

/** One required asset review view before anything has been captured for it. */
export type IAutoMovieAssetReviewView = Omit<
  IAutoMovieAssetTurntableView,
  "frame"
>;

/**
 * The complete view set one asset review is judged from, in canonical order.
 *
 * Four horizontal quarters at one raised elevation show silhouette and
 * proportion from every side; the steep outline pass shows the footprint and
 * the parts a beauty render hides inside it; a rigged model adds its
 * extreme-range pose, because a rig that reads correctly at rest is exactly the
 * rig whose limits nobody looked at.
 *
 * The set is declared here rather than by the caller so that the tool producing
 * the evidence and the review consuming it cannot drift apart. A reviewer who
 * chose its own angles could cover an asset without ever opening the side the
 * defect was on, and the review would still read complete.
 */
export const autoMovieAssetReviewViews = (props: {
  /** Whether the compiled model carries a humanoid skeleton. */
  rigged: boolean;
}): IAutoMovieAssetReviewView[] => [
  {
    id: "turntable-front",
    angleDeg: 0,
    elevationDeg: 15,
    pose: "rest",
    pass: "beauty",
  },
  {
    id: "turntable-right",
    angleDeg: 90,
    elevationDeg: 15,
    pose: "rest",
    pass: "beauty",
  },
  {
    id: "turntable-back",
    angleDeg: 180,
    elevationDeg: 15,
    pose: "rest",
    pass: "beauty",
  },
  {
    id: "turntable-left",
    angleDeg: 270,
    elevationDeg: 15,
    pose: "rest",
    pass: "beauty",
  },
  {
    id: "top-outline",
    angleDeg: 0,
    elevationDeg: 65,
    pose: "rest",
    pass: "outline",
  },
  ...(props.rigged
    ? [
        {
          id: "rig-rom-extremes",
          angleDeg: 0,
          elevationDeg: 15,
          pose: "rom-extremes" as const,
          pass: "beauty" as const,
        },
      ]
    : []),
];
