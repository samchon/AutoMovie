import type { AutoMovieGuidePass } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

/**
 * Load the declared view set from source without making it public API.
 *
 * The capture path and both review gates already import it inside the package,
 * so it is a consumed internal rather than an export; resolving it here through
 * the launcher's own require hook keeps it that way.
 */
const unit = loadSourceModule<{
  autoMovieAssetReviewViews: (props: { rigged: boolean }) => Array<{
    id: string;
    angleDeg: number;
    elevationDeg: number;
    pose: "rest" | "rom-extremes";
    pass: AutoMovieGuidePass;
  }>;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/assetReviewViews.ts",
  ),
);
const autoMovieAssetReviewViews = unit.autoMovieAssetReviewViews;

/**
 * A bounded object owes its six faces and two opposing obliques, not an orbit.
 *
 * The design-disclosure guidance the set is taken from asks for enough views to
 * disclose a form completely and names front, rear, left, right, top and bottom,
 * with perspective views for the three-dimensional reading those six cannot
 * give. Four horizontal quarters raised fifteen degrees, which is what this set
 * used to be, satisfies neither half: the raise skews every silhouette's
 * top-to-bottom relation while still leaving the corner joins, the plan and the
 * soffit unread.
 *
 * So the faces are taken straight on, the poles as steeply as the capture
 * contract's own elevation interval admits, and the two obliques a half-turn
 * apart so that no corner survives both. The outline pass answers a different
 * question from the top face and neither stands in for the other, and a rig's
 * extreme-range pose is added to the eight rather than replacing any of them.
 *
 * Scenarios:
 *
 * 1. A rigless model owes exactly nine views, in canonical order, at the exact
 *    angles, elevations, poses and passes the contract states.
 * 2. The four horizontal faces are taken at zero elevation and a quarter turn
 *    apart, which is what makes them face views rather than raised quarters.
 * 3. The two poles are the same azimuth at opposite elevations, and both sit
 *    inside the capture contract's `[-85, 85]` interval.
 * 4. The two obliques share an elevation and stand exactly a half turn apart.
 * 5. No two views name the same id, and no two ask for the same azimuth,
 *    elevation, pose and pass, so no view in the set is another one twice.
 * 6. Every azimuth is inside `[0, 360)`, so no view is refused as out of range
 *    by the surface that has to draw it.
 * 7. A rigged model owes the same nine plus its extreme-range pose, and nothing
 *    in the rest-pose set moves to make room for it.
 */
export const test_production_asset_review_view_set = (): void => {
  const rest = autoMovieAssetReviewViews({ rigged: false });

  TestValidator.equals(
    "a rigless model owes the six faces, two obliques and the outline pass",
    rest.map((view) => [
      view.id,
      view.angleDeg,
      view.elevationDeg,
      view.pose,
      view.pass,
    ]),
    [
      ["turntable-front", 0, 0, "rest", "beauty"],
      ["turntable-right", 90, 0, "rest", "beauty"],
      ["turntable-back", 180, 0, "rest", "beauty"],
      ["turntable-left", 270, 0, "rest", "beauty"],
      ["turntable-top", 0, 85, "rest", "beauty"],
      ["turntable-bottom", 0, -85, "rest", "beauty"],
      ["oblique-front-right-top", 45, 30, "rest", "beauty"],
      ["oblique-rear-left-top", 225, 30, "rest", "beauty"],
      ["top-outline", 0, 65, "rest", "outline"],
    ],
  );

  TestValidator.equals(
    "the set closes every axis and repeats no view",
    namedFacts([
      [
        "the four horizontal faces are straight on, a quarter turn apart",
        () =>
          [0, 90, 180, 270].every(
            (angleDeg, index) =>
              rest[index]!.angleDeg === angleDeg &&
              rest[index]!.elevationDeg === 0,
          ),
      ],
      [
        "the poles are one azimuth at opposite elevations",
        () =>
          rest[4]!.angleDeg === rest[5]!.angleDeg &&
          rest[4]!.elevationDeg === -rest[5]!.elevationDeg,
      ],
      [
        "and every elevation is inside the interval capture will accept",
        () =>
          rest.every(
            (view) => view.elevationDeg >= -85 && view.elevationDeg <= 85,
          ),
      ],
      [
        "the two obliques stand a half turn apart at one elevation",
        () =>
          rest[6]!.elevationDeg === rest[7]!.elevationDeg &&
          Math.abs(rest[7]!.angleDeg - rest[6]!.angleDeg) === 180,
      ],
      [
        "every azimuth is inside the interval capture will accept",
        () => rest.every((view) => view.angleDeg >= 0 && view.angleDeg < 360),
      ],
      [
        "no id repeats",
        () => new Set(rest.map((view) => view.id)).size === rest.length,
      ],
      [
        "and no two views ask for the same picture",
        () =>
          new Set(
            rest.map((view) =>
              JSON.stringify([
                view.angleDeg,
                view.elevationDeg,
                view.pose,
                view.pass,
              ]),
            ),
          ).size === rest.length,
      ],
    ]),
    {
      "the four horizontal faces are straight on, a quarter turn apart": true,
      "the poles are one azimuth at opposite elevations": true,
      "and every elevation is inside the interval capture will accept": true,
      "the two obliques stand a half turn apart at one elevation": true,
      "every azimuth is inside the interval capture will accept": true,
      "no id repeats": true,
      "and no two views ask for the same picture": true,
    },
  );

  const rigged = autoMovieAssetReviewViews({ rigged: true });

  TestValidator.equals(
    "a rig adds its extreme range without displacing a shape view",
    {
      added: rigged
        .slice(rest.length)
        .map((view) => [view.id, view.pose, view.pass]),
      restUnchanged:
        JSON.stringify(rigged.slice(0, rest.length)) === JSON.stringify(rest),
    },
    {
      added: [["rig-rom-extremes", "rom-extremes", "beauty"]],
      restUnchanged: true,
    },
  );
};
