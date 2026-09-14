import {
  type IPortraitEyebrowFlowProfile,
  createPortraitEyebrowFlow,
} from "@automovie/human/components/eyebrowFlow";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * Brow direction witnesses retain a bounded cross-brow endpoint and owned data.
 *
 * Scenarios:
 * 1. Three hand-authored stations interpolate both root-band directions. The
 *    second interval's quarter has the independently calculated weight 5/32.
 * 2. Caller mutations cannot change a previously constructed sampler. Exactly
 *    32 witnesses work; missing, unordered and nonfinite witnesses refuse.
 * 3. Boundary tips and signed lateral sweeps remain valid; adjacent invalid
 *    tips and query fractions refuse, including nonfinite root fractions.
 */
export const test_subject_brow_flow_profile = (): void => {
  const input: IPortraitEyebrowFlowProfile = {
    sections: [
      {
        at: 0,
        lower: { tip: 1, outwardBend: 0 },
        upper: { tip: 1, outwardBend: 0 },
      },
      {
        at: 0.5,
        lower: { tip: 0.5, outwardBend: 4 },
        upper: { tip: 0.5, outwardBend: 2 },
      },
      {
        at: 1,
        lower: { tip: 0, outwardBend: 6 },
        upper: { tip: 0, outwardBend: -4 },
      },
    ],
  };
  const flow = createPortraitEyebrowFlow(input);
  for (const [at, root, tip, bend] of [
    [0, 0, 1, 0],
    [0.5, 0, 0.5, 4],
    [0.5, 1, 0.5, 2],
    [0.5, 0.5, 0.5, 3],
    [0.25, 0.5, 0.75, 1.5],
    [1, 1, 0, -4],
    [0.625, 0, 0.5 - (0.5 * 5) / 32, 4 + (2 * 5) / 32],
  ]) {
    const sampled = flow(at, root);
    TestValidator.predicate(
      "hand-derived flow",
      nclose(sampled.tip, tip) && nclose(sampled.outwardBend, bend),
    );
  }
  input.sections[0].lower.tip = 0;
  TestValidator.equals("owned original endpoint", flow(0, 0).tip, 1);
  TestValidator.equals(
    "new owner observes edit",
    createPortraitEyebrowFlow(input)(0, 0).tip,
    0,
  );
  const invalid: ((profile: IPortraitEyebrowFlowProfile) => void)[] = [
    (p) => {
      p.sections = [];
    },
    (p) => {
      p.sections = p.sections.slice(0, 1);
    },
    (p) => {
      p.sections = Array.from({ length: 33 }, (_, i) => ({
        ...p.sections[1],
        at: i / 32,
      }));
    },
    (p) => {
      p.sections[0].at = 0.1;
    },
    (p) => {
      p.sections[2].at = 0.9;
    },
    (p) => {
      p.sections[1].at = 0;
    },
    (p) => {
      p.sections[1].at = NaN;
    },
    (p) => {
      p.sections[1].lower.tip = -0.1;
    },
    (p) => {
      p.sections[1].upper.tip = 1.1;
    },
    (p) => {
      p.sections[1].lower.tip = NaN;
    },
    (p) => {
      p.sections[1].upper.outwardBend = Infinity;
    },
  ];
  for (const mutate of invalid) {
    const candidate = structuredClone(input);
    mutate(candidate);
    TestValidator.predicate(
      "invalid flow refuses",
      throwsError(() => createPortraitEyebrowFlow(candidate), "Eyebrow flow"),
    );
  }
  for (const at of [-0.1, 1.1, NaN, Infinity]) {
    TestValidator.predicate(
      "invalid progress refuses",
      throwsError(() => flow(at, 0.5)),
    );
    TestValidator.predicate(
      "invalid root refuses",
      throwsError(() => flow(0.5, at)),
    );
  }
  const maximum = {
    sections: Array.from({ length: 32 }, (_, i) => ({
      ...input.sections[1],
      at: i / 31,
    })),
  };
  TestValidator.predicate(
    "maximum population samples",
    nclose(createPortraitEyebrowFlow(maximum)(1, 1).outwardBend, 2),
  );
};
