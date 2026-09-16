import {
  buildPortraitHead,
  createPortraitFacePerformanceComponent,
  createPortraitJawContinuation,
  portraitNeckShape,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * The common head consumer carries local submental shape through jaw motion.
 *
 * Scenarios:
 * 1. At a 25-degree jaw opening, 16 mm projection changes the cervical field
 *    while preserving existing facial targets, topology and the lower crop.
 * 2. Both constructions retain the caller's reference host. Optical and oral
 *    interiors are outside this unit's neck-assembly responsibility.
 */
export const test_subject_head_submental_performance = (): void => {
  const { host, bindings } = humanFaceFixture().basis;
  bindings.jawHinge = { x: 0, y: 0, z: -45 };
  const before = structuredClone(host),
    expression = { jawOpen: 25 };
  const component = createPortraitFacePerformanceComponent(
    bindings,
    {},
    expression,
  );
  const construct = (submentalProjection: number) => {
    const neck = { ...portraitNeckShape, submentalProjection };
    return buildPortraitHead(host, [component], 0, [], {
      neck,
      performance: createPortraitJawContinuation(
        host,
        bindings,
        {},
        expression,
        neck,
      ),
    });
  };
  const base = construct(0).refined,
    padded = construct(16).refined;
  TestValidator.equals("same topology", padded.indices, base.indices);
  TestValidator.equals("same material labels", padded.groups, base.groups);
  TestValidator.equals(
    "resident facial targets fixed",
    padded.positions.slice(0, host.positions.length),
    base.positions.slice(0, host.positions.length),
  );
  TestValidator.predicate(
    "projection reaches performed skin",
    base.positions.some((point, index) =>
      point.some(
        (value, axis) => Math.abs(padded.positions[index][axis] - value) > 1,
      ),
    ),
  );
  TestValidator.predicate(
    "lower crop remains fixed",
    base.positions.every(
      (point, index) =>
        point[1] > portraitNeckShape.lower.y ||
        point.every(
          (value, axis) =>
            Math.abs(padded.positions[index][axis] - value) < 1e-10,
        ),
    ),
  );
  TestValidator.equals("reference host retained", host, before);
};
