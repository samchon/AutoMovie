import {
  type IAutoMovieProductionRenderFrame,
  productionRenderLayersForPass,
} from "@automovie/engine";
import type { AutoMovieGuidePass } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

const frame = (
  layers: IAutoMovieProductionRenderFrame["layers"],
): IAutoMovieProductionRenderFrame => ({
  globalFrame: 4,
  timelineFrame: 4,
  timeSeconds: 4 / 24,
  layers,
});

/**
 * Beauty keeps a transition's blend; structural passes never blend shots.
 *
 * A structural pass encodes a classification or a geometric field, so mixing
 * two shots' values would invent a value neither shot drew. The expectation is
 * the requirement's rule itself: beauty receives the sampled layers unchanged,
 * and every structural pass receives the single heaviest layer at full weight,
 * with the incoming layer winning an exact tie.
 *
 * Scenarios:
 *
 * 1. Beauty returns the dissolve's two layers unchanged, and mutating the result
 *    leaves the sampled frame intact.
 * 2. Every structural pass selects the outgoing layer when it is heavier and
 *    the incoming layer when it is heavier, at weight 1.
 * 3. An exact half-and-half dissolve selects the incoming layer.
 * 4. A single fading layer keeps its source frame and is raised to full weight
 *    for a structural pass while beauty keeps the fade weight.
 */
export const test_film_production_pass_layers = (): void => {
  const outgoingHeavy = frame([
    { shot: "a", sourceFrame: 20, weight: 0.75 },
    { shot: "b", sourceFrame: 3, weight: 0.25 },
  ]);
  const beauty = productionRenderLayersForPass(outgoingHeavy, "beauty");
  beauty[0]!.weight = 0;
  TestValidator.equals(
    "beauty keeps the sampled blend and returns a copy",
    [productionRenderLayersForPass(outgoingHeavy, "beauty"), beauty[0]!.weight],
    [
      [
        { shot: "a", sourceFrame: 20, weight: 0.75 },
        { shot: "b", sourceFrame: 3, weight: 0.25 },
      ],
      0,
    ],
  );

  const structural: AutoMovieGuidePass[] = [
    "depth",
    "mask",
    "normal",
    "outline",
    "pose",
  ];
  const incomingHeavy = frame([
    { shot: "a", sourceFrame: 21, weight: 0.25 },
    { shot: "b", sourceFrame: 4, weight: 0.75 },
  ]);
  TestValidator.equals(
    "structural passes select the heavier layer at full weight",
    structural.map((pass) => [
      productionRenderLayersForPass(outgoingHeavy, pass),
      productionRenderLayersForPass(incomingHeavy, pass),
    ]),
    structural.map(() => [
      [{ shot: "a", sourceFrame: 20, weight: 1 }],
      [{ shot: "b", sourceFrame: 4, weight: 1 }],
    ]),
  );
  TestValidator.equals(
    "an exact tie selects the incoming layer",
    productionRenderLayersForPass(
      frame([
        { shot: "a", sourceFrame: 20, weight: 0.5 },
        { shot: "b", sourceFrame: 3, weight: 0.5 },
      ]),
      "mask",
    ),
    [{ shot: "b", sourceFrame: 3, weight: 1 }],
  );
  const fading = frame([{ shot: "f", sourceFrame: 9, weight: 0.25 }]);
  TestValidator.equals(
    "a fading layer is full weight for structure and faded for beauty",
    [
      productionRenderLayersForPass(fading, "depth"),
      productionRenderLayersForPass(fading, "beauty"),
    ],
    [
      [{ shot: "f", sourceFrame: 9, weight: 1 }],
      [{ shot: "f", sourceFrame: 9, weight: 0.25 }],
    ],
  );
};
