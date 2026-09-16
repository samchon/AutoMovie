import { buildPortraitHead } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * A caller-supplied continuation cannot emit malformed coordinate buffers.
 *
 * Scenarios:
 * 1. Identity callbacks reproduce the original assembled skin exactly.
 * 2. Wrong-length reference coordinates and nonfinite posed coordinates refuse
 *    before subdivision; caller inputs remain owned even if a callback mutates.
 */
export const test_subject_head_performance_refusals = (): void => {
  const { host } = humanFaceFixture().basis;
  const baseline = buildPortraitHead(host, [], 0);
  const identity = { reference: (p: number[]) => p, pose: (p: number[]) => p };
  TestValidator.equals(
    "identity continuation",
    buildPortraitHead(host, [], 0, [], { performance: identity }),
    baseline,
  );
  const before = structuredClone(host);
  TestValidator.predicate(
    "invalid reference",
    throwsError(() =>
      buildPortraitHead(host, [], 0, [], {
        performance: {
          ...identity,
          reference: (p) => {
            p.length = 2;
            return p;
          },
        },
      }),
    ),
  );
  TestValidator.predicate(
    "invalid pose",
    throwsError(() =>
      buildPortraitHead(host, [], 0, [], {
        performance: {
          ...identity,
          pose: (p) => {
            p[0] = NaN;
            return p;
          },
        },
      }),
    ),
  );
  TestValidator.equals("callback cannot corrupt caller", host, before);
};
