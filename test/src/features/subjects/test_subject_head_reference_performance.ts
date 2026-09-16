import {
  buildPortraitHead,
  createPortraitFacePerformanceComponent,
  createPortraitJawContinuation,
  portraitNeckShape,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { nclose, throwsError } from "../internal/predicates";

/**
 * A performed chin may descend past a reference neck section without rebuilding
 * the static collar from that new pose or separating the shared facial seam.
 *
 * Scenarios:
 * 1. Reference formation succeeds where reconstruction from a rotated oval
 *    refuses its cervical ordering. Resident face targets are not posed twice.
 * 2. The continuation retains reference topology and the anchored lower crop.
 * 3. Omitted/matching performance preserves exact existing assembly and caller
 *    ownership, including the independent original cranial/neck guard.
 */
export const test_subject_head_reference_performance = (): void => {
  const { host, bindings } = humanFaceFixture().basis;
  bindings.jawHinge = { x: 0, y: 0, z: -45 };
  const before = structuredClone(host),
    neck = structuredClone(portraitNeckShape);
  neck.upper.y = -100;
  const component = createPortraitFacePerformanceComponent(
    bindings,
    {},
    { jawOpen: 25 },
  );
  TestValidator.predicate(
    "posed reconstruction refuses",
    throwsError(() => buildPortraitHead(host, [component], 0, [], { neck })),
  );
  const reference = buildPortraitHead(host, [], 0, [], { neck });
  const performance = createPortraitJawContinuation(
    host,
    bindings,
    {},
    { jawOpen: 25 },
    neck,
  )!;
  const moved = buildPortraitHead(host, [component], 0, [], {
    neck,
    performance,
  });
  TestValidator.equals(
    "shared topology",
    moved.refined.indices,
    reference.refined.indices,
  );
  TestValidator.equals(
    "material ownership",
    moved.refined.groups,
    reference.refined.groups,
  );
  TestValidator.equals(
    "not twice posed",
    moved.refined.positions[152],
    moved.source[152],
  );
  TestValidator.predicate(
    "chin actually moves",
    moved.source[152][1] < reference.source[152][1],
  );
  TestValidator.predicate(
    "lower crop stays anchored",
    reference.refined.positions.every(
      (point, i) =>
        point[1] > neck.lower.y ||
        point.every((v, axis) => nclose(v, moved.refined.positions[i][axis])),
    ),
  );
  TestValidator.equals("input retained", host, before);
  TestValidator.equals(
    "matching continuation omitted",
    createPortraitJawContinuation(host, bindings, {}, {}, neck),
    undefined,
  );
  const invalid = structuredClone(neck);
  invalid.upper.y = 100;
  TestValidator.predicate(
    "reference neck guard retained",
    throwsError(() =>
      buildPortraitHead(host, [component], 0, [], {
        neck: invalid,
        performance,
      }),
    ),
  );
};
