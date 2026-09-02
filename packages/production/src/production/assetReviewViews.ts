import type { IAutoMovieAssetTurntableView } from "@automovie/interface";

/**
 * How steeply the top and bottom face views may look, in degrees.
 *
 * A true plan and a true soffit are ninety degrees, and the capture contract
 * bounds an asset turntable's elevation to `[-85, 85]` so that the camera's own
 * up axis never becomes degenerate. Eighty-five is therefore the canonical face
 * view this surface can actually draw, and stating that here keeps the two ends
 * of the axis symmetric rather than leaving one of them a typed constant and
 * the other its negation by accident.
 */
const AUTOMOVIE_ASSET_REVIEW_POLE_DEG = 85;

/** One required asset review view before anything has been captured for it. */
export type IAutoMovieAssetReviewView = Omit<
  IAutoMovieAssetTurntableView,
  "frame"
>;

/**
 * The complete view set one asset review is judged from, in canonical order.
 *
 * The closed minimum for a bounded rigid subject is the six canonical faces
 * plus two opposing oblique perspectives. Front, rear, left and right are taken
 * straight on, because a face view raised off the horizon is neither a face nor
 * an oblique: it skews the silhouette's top-to-bottom relation while still
 * hiding the corner joins an oblique exists to show. Top and bottom close the
 * two axes an orbit never reaches at all, and are taken as steeply as the
 * capture contract's elevation interval admits. The two obliques stand a
 * half-turn apart so that between them no corner of the subject stays unseen,
 * which is the depth reading the orthographic six cannot give.
 *
 * The steep outline pass is a different question from the beauty top view and
 * neither answers the other: it reads the footprint and the parts a lit render
 * hides inside the silhouette. A rigged model adds its extreme-range pose,
 * because a rig that reads correctly at rest is exactly the rig whose limits
 * nobody looked at, and that pose is added to the eight rather than replacing
 * any of them.
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
    elevationDeg: 0,
    pose: "rest",
    pass: "beauty",
  },
  {
    id: "turntable-right",
    angleDeg: 90,
    elevationDeg: 0,
    pose: "rest",
    pass: "beauty",
  },
  {
    id: "turntable-back",
    angleDeg: 180,
    elevationDeg: 0,
    pose: "rest",
    pass: "beauty",
  },
  {
    id: "turntable-left",
    angleDeg: 270,
    elevationDeg: 0,
    pose: "rest",
    pass: "beauty",
  },
  {
    id: "turntable-top",
    angleDeg: 0,
    elevationDeg: AUTOMOVIE_ASSET_REVIEW_POLE_DEG,
    pose: "rest",
    pass: "beauty",
  },
  {
    id: "turntable-bottom",
    angleDeg: 0,
    elevationDeg: -AUTOMOVIE_ASSET_REVIEW_POLE_DEG,
    pose: "rest",
    pass: "beauty",
  },
  {
    id: "oblique-front-right-top",
    angleDeg: 45,
    elevationDeg: 30,
    pose: "rest",
    pass: "beauty",
  },
  {
    id: "oblique-rear-left-top",
    angleDeg: 225,
    elevationDeg: 30,
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
