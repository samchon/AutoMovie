import { assertProductionRenditionClipDelivery } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";
import { productionH264Mp4 } from "./productionMediaFixtures";

/**
 * A repaint clip is delivered only when it matches its contract exactly.
 *
 * A rendition arrives from a host diffusion adapter, so nothing about it is
 * trusted: its raster, its rational frame clock, its frame count and its
 * runtime must all equal what the production declared, or the cut would splice
 * a clip that plays at a different size or speed than the timeline believes.
 * The refusal had no test -- every caller passed a clip it had just built to
 * the contract it was checking against.
 *
 * Scenarios:
 *
 * 1. A clip matching its declared raster, clock, frame count and runtime is
 *    delivered without complaint.
 * 2. Each of width, height, frame count, fps and runtime is refused on its own,
 *    with the shot named in the refusal so a multi-shot cut says which one.
 */
export const test_production_rendition_delivery = async (): Promise<void> => {
  const width = 16;
  const height = 16;
  const fps = 24;
  const frameCount = 4;
  const runtimeSeconds = frameCount / fps;
  const bytes = await productionH264Mp4({ width, height, fps, frameCount });
  const contract = {
    bytes,
    shot: "opening",
    width,
    height,
    fps,
    frameCount,
    runtimeSeconds,
  };
  const refused = (overrides: Record<string, number>): boolean =>
    throwsError(
      () =>
        assertProductionRenditionClipDelivery({ ...contract, ...overrides }),
      ['Repaint clip "opening"', "raster"],
    );
  TestValidator.equals(
    "a repaint clip is delivered only against its exact contract",
    namedFacts([
      [
        "exactContractIsDelivered",
        () => {
          assertProductionRenditionClipDelivery(contract);
          return true;
        },
      ],
      ["aWiderRasterIsRefused", () => refused({ width: width + 2 })],
      ["aTallerRasterIsRefused", () => refused({ height: height + 2 })],
      ["aDifferentFrameCountIsRefused", () => refused({ frameCount: 5 })],
      ["aDifferentClockIsRefused", () => refused({ fps: 30 })],
      [
        "aDifferentRuntimeIsRefused",
        () => refused({ runtimeSeconds: runtimeSeconds + 1 }),
      ],
    ]),
    {
      exactContractIsDelivered: true,
      aWiderRasterIsRefused: true,
      aTallerRasterIsRefused: true,
      aDifferentFrameCountIsRefused: true,
      aDifferentClockIsRefused: true,
      aDifferentRuntimeIsRefused: true,
    },
  );
};
