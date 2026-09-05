import { IAutoMovieDeliveryCrop } from "@automovie/interface";
import {
  resolveProductionRenderTierFrameFormat,
  validateAutoMovieProductionGraph,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import { productionDesign } from "./productionFixtures";

const cropDiagnostics = (crop: IAutoMovieDeliveryCrop) =>
  validateAutoMovieProductionGraph({
    production: productionDesign({
      frameFormat: {
        width: 1_920,
        height: 1_080,
        fps: 24,
        colorSpace: "srgb",
        crop,
      },
    }),
    models: new Map(),
    world: null,
    formations: new Map(),
    shots: new Map(),
    acceptance: new Map(),
  }).filter((diagnostic) => diagnostic.message.includes("frameFormat.crop"));

/** Production validation and proxy derivation preserve one portable crop. */
export const test_production_delivery_crop = (): void => {
  const crop: IAutoMovieDeliveryCrop = {
    left: 0.125,
    top: 0.25,
    right: 0.875,
    bottom: 0.75,
  };
  const proxy = resolveProductionRenderTierFrameFormat(
    {
      width: 1_920,
      height: 1_080,
      fps: 24,
      colorSpace: "srgb",
      crop,
    },
    { kind: "proxy", resolutionScale: 0.5, frameStep: 2 },
  );
  crop.left = 0;
  TestValidator.equals(
    "proxy raster and clock change without changing or aliasing its crop",
    proxy,
    {
      width: 960,
      height: 540,
      fps: 12,
      frameRate: { numerator: 12, denominator: 1 },
      colorSpace: "srgb",
      crop: { left: 0.125, top: 0.25, right: 0.875, bottom: 0.75 },
    },
  );

  TestValidator.equals(
    "valid edge and whole crops pass graph validation",
    namedFacts([
      [
        "whole",
        () =>
          cropDiagnostics({ left: 0, top: 0, right: 1, bottom: 1 }).length ===
          0,
      ],
      [
        "narrow",
        () =>
          cropDiagnostics({
            left: 0.25,
            top: 0.25,
            right: 0.75,
            bottom: 0.75,
          }).length === 0,
      ],
    ]),
    { whole: true, narrow: true },
  );

  const invalid = [
    { left: Number.NaN, top: 0, right: 1, bottom: 1 },
    { left: -0.1, top: 0, right: 1, bottom: 1 },
    { left: 0, top: 0, right: 1.1, bottom: 1 },
    { left: 0.5, top: 0, right: 0.5, bottom: 1 },
    { left: 0, top: 0.75, right: 1, bottom: 0.25 },
  ] satisfies IAutoMovieDeliveryCrop[];
  TestValidator.predicate(
    "invalid, unordered, and out-of-raster crops are addressed refusals",
    invalid.every((candidate) => {
      const diagnostics = cropDiagnostics(candidate);
      return (
        diagnostics.length > 0 &&
        diagnostics.every(
          (diagnostic) =>
            diagnostic.code === "design-range-invalid" &&
            diagnostic.target === "production" &&
            diagnostic.path?.endsWith("/production.json") === true,
        )
      );
    }),
  );
};
