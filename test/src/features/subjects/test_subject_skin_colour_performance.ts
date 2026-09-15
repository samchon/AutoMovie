import {
  buildPortraitHead,
  createPortraitFacePerformanceComponent,
  createPortraitSkinColour,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { skinColourRegion } from "../internal/skinColourFixture";

/**
 * Performed skin carries the observed cage's material coordinates.
 *
 * Scenarios:
 * 1. Raising one brow changes geometry while every transported reference
 *    sample stays equal to the unperformed common Loop surface.
 * 2. The rendered skin's RGB is present and nonwhite, without a second surface.
 */
export const test_subject_skin_colour_performance = (): void => {
  const { host, bindings } = humanFaceFixture().basis;
  const rest = createPortraitFacePerformanceComponent(bindings, {}, {});
  const moved = createPortraitFacePerformanceComponent(
    bindings,
    {},
    { browRaise: { right: 1 } },
  );
  const reference = buildPortraitHead(host, [rest], 1);
  const sample = createPortraitSkinColour(host, [
    {
      ...skinColourRegion(),
      anchor: bindings.eyes.right.browTop[1],
      radius: [30, 30, 30],
    },
  ]);
  const performed = buildPortraitHead(host, [moved], 1, [], {
    appearance: { host, components: [rest], sample },
  });
  TestValidator.equals(
    "reference coordinates invariant",
    performed.refined.reference,
    reference.refined.positions,
  );
  TestValidator.predicate(
    "performed geometry changes",
    performed.refined.positions.some((p, i) =>
      p.some((v, axis) => v !== reference.refined.positions[i][axis]),
    ),
  );
  TestValidator.equals(
    "one skin, no overlay",
    performed.parts.map((p) => p.id),
    reference.parts.map((p) => p.id),
  );
  TestValidator.predicate(
    "nonwhite attached colour",
    performed.parts.some(
      (p) =>
        p.geometry.type === "mesh" &&
        p.geometry.mesh.colors!.some((v) => v < 1),
    ),
  );
};
